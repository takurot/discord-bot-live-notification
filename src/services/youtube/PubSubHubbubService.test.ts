import { PubSubHubbubService } from './PubSubHubbubService';
import { YouTubeApiClient } from './YouTubeApiClient';
import { StreamerRepository } from '../../models/repositories/StreamerRepository';

import { EventEmitter } from 'events';
import { Request, Response } from 'express';

// Mock dependencies
jest.mock('./YouTubeApiClient');
jest.mock('../../models/repositories/StreamerRepository');

jest.mock('../../utils/logger');

describe('PubSubHubbubService', () => {
    let service: PubSubHubbubService;
    let mockYouTubeApiClient: jest.Mocked<YouTubeApiClient>;
    let mockStreamerRepository: jest.Mocked<StreamerRepository>;

    let mockEventEmitter: EventEmitter;
    const callbackUrl = 'http://localhost:3000/callback';

    beforeEach(() => {
        mockYouTubeApiClient = new YouTubeApiClient('api-key') as jest.Mocked<YouTubeApiClient>;
        mockStreamerRepository = new StreamerRepository({} as any) as jest.Mocked<StreamerRepository>;

        mockEventEmitter = new EventEmitter();
        jest.spyOn(mockEventEmitter, 'emit');

        service = new PubSubHubbubService(
            mockYouTubeApiClient,
            mockStreamerRepository,

            mockEventEmitter,
            callbackUrl
        );

        // Mock fetch
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('subscribe', () => {
        it('should send subscription request to Hub', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
            });

            await service.subscribe('channel-id');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://pubsubhubbub.appspot.com/subscribe',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('hub.mode=subscribe'),
                })
            );
        });

        it('should throw error if subscription fails', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                statusText: 'Bad Request',
            });

            await expect(service.subscribe('channel-id')).rejects.toThrow('Failed to subscribe: Bad Request');
        });
    });

    describe('unsubscribe', () => {
        it('should send unsubscribe request to Hub', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
            });

            await service.unsubscribe('channel-id');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://pubsubhubbub.appspot.com/subscribe',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('hub.mode=unsubscribe'),
                })
            );
        });
    });

    describe('handleVerification', () => {
        let req: Partial<Request>;
        let res: Partial<Response>;
        let sendMock: jest.Mock;
        let statusMock: jest.Mock;

        beforeEach(() => {
            sendMock = jest.fn();
            statusMock = jest.fn().mockReturnValue({ send: sendMock });
            res = {
                status: statusMock,
                send: sendMock,
            };
        });

        it('should respond with challenge if verification request is valid', () => {
            req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.topic': 'topic-url',
                    'hub.challenge': 'challenge-token',
                },
            };

            service.handleVerification(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(sendMock).toHaveBeenCalledWith('challenge-token');
        });

        it('should respond with 400 if verification request is invalid', () => {
            req = {
                query: {},
            };

            service.handleVerification(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(sendMock).toHaveBeenCalledWith('Bad Request');
        });
    });

    describe('handleNotification', () => {
        let req: Partial<Request>;
        let res: Partial<Response>;
        let sendMock: jest.Mock;
        let statusMock: jest.Mock;

        beforeEach(() => {
            sendMock = jest.fn();
            statusMock = jest.fn().mockReturnValue({ send: sendMock });
            res = {
                status: statusMock,
                send: sendMock,
            };
        });

        it('should verify live status and emit streamStarted event if live', async () => {
            const xml = `
        <feed>
          <entry>
            <yt:videoId>video-id</yt:videoId>
            <yt:channelId>channel-id</yt:channelId>
            <title>Stream Title</title>
          </entry>
        </feed>
      `;
            req = { body: xml };

            mockYouTubeApiClient.getStream.mockResolvedValue({
                id: 'video-id',
                userId: 'channel-id',
                title: 'Stream Title',
                thumbnailUrl: 'thumb.jpg',
                viewerCount: 100,
                startedAt: new Date().toISOString(),
                userDisplayName: 'Streamer Name',
                gameName: null,

            });

            mockStreamerRepository.findByStreamerId.mockResolvedValue({
                id: '1',
                streamerId: 'channel-id',
                username: 'Streamer Name',
                lastStatus: 'Offline',
            } as any);

            await service.handleNotification(req as Request, res as Response);

            expect(mockYouTubeApiClient.getStream).toHaveBeenCalledWith('channel-id');
            expect(mockStreamerRepository.updateStatus).toHaveBeenCalledWith('channel-id', 'Live');
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('streamStarted', expect.anything());
        });

        it('should verify live status and emit streamEnded event if offline', async () => {
            const xml = `
        <feed>
          <entry>
            <yt:videoId>video-id</yt:videoId>
            <yt:channelId>channel-id</yt:channelId>
          </entry>
        </feed>
      `;
            req = { body: xml };

            mockYouTubeApiClient.getStream.mockResolvedValue(null); // Offline

            mockStreamerRepository.findByStreamerId.mockResolvedValue({
                id: '1',
                streamerId: 'channel-id',
                username: 'Streamer Name',
                lastStatus: 'Live',
            } as any);

            await service.handleNotification(req as Request, res as Response);

            expect(mockStreamerRepository.updateStatus).toHaveBeenCalledWith('channel-id', 'Offline');
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('streamEnded', expect.anything());
        });

        it('should ignore if already live', async () => {
            const xml = `
        <feed>
          <entry>
            <yt:videoId>video-id</yt:videoId>
            <yt:channelId>channel-id</yt:channelId>
          </entry>
        </feed>
      `;
            req = { body: xml };

            mockYouTubeApiClient.getStream.mockResolvedValue({
                id: 'video-id',
                userId: 'channel-id',
                title: 'Stream Title',
                startedAt: new Date().toISOString(),
                userDisplayName: 'Streamer Name',
                gameName: null,

            } as any);

            mockStreamerRepository.findByStreamerId.mockResolvedValue({
                id: '1',
                streamerId: 'channel-id',
                lastStatus: 'Live',
            } as any);

            await service.handleNotification(req as Request, res as Response);

            expect(mockStreamerRepository.updateStatus).not.toHaveBeenCalled();
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });
    });
});
