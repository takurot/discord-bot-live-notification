import { YouTubePollingService } from './YouTubePollingService';
import { YouTubeApiClient } from '../youtube/YouTubeApiClient';
import {
    SubscriptionRepository,
    StreamerRepository,
} from '../../models/repositories';
import { EventEmitter } from 'events';

// モックの設定
jest.mock('../youtube/YouTubeApiClient');
jest.mock('../../models/repositories');

describe('YouTubePollingService', () => {
    let pollingService: YouTubePollingService;
    let mockYouTubeApiClient: jest.Mocked<YouTubeApiClient>;
    let mockSubscriptionRepository: jest.Mocked<SubscriptionRepository>;
    let mockStreamerRepository: jest.Mocked<StreamerRepository>;
    let eventEmitter: EventEmitter;

    beforeEach(() => {
        mockYouTubeApiClient = new YouTubeApiClient(
            'test-api-key',
        ) as jest.Mocked<YouTubeApiClient>;
        mockSubscriptionRepository =
            new SubscriptionRepository(null as any) as jest.Mocked<SubscriptionRepository>;
        mockStreamerRepository =
            new StreamerRepository(null as any) as jest.Mocked<StreamerRepository>;
        eventEmitter = new EventEmitter();

        pollingService = new YouTubePollingService(
            mockYouTubeApiClient,
            mockSubscriptionRepository,
            mockStreamerRepository,
            eventEmitter,
        );

        // デフォルトのモック実装
        mockSubscriptionRepository.findAll = jest.fn().mockResolvedValue([]);
        mockStreamerRepository.updateStatus = jest.fn().mockResolvedValue({});
        mockYouTubeApiClient.getStream = jest.fn().mockResolvedValue(null);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('pollOnce', () => {
        it('should fetch all subscriptions and check stream status', async () => {
            const mockSubscriptions = [
                {
                    id: 'sub1',
                    serverId: 'server1',
                    streamerId: 'UC1234567890123456789012',
                    notificationChannelId: 'channel1',
                    customMessage: null,
                    mentionRoleId: null,
                    embedColor: null,
                    embedFooter: null,
                    notificationMessageId: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockStreamers = [
                {
                    id: 'str1',
                    streamerId: 'UC1234567890123456789012',
                    platform: 'YouTube',
                    channelId: 'UC1234567890123456789012',
                    username: 'TestChannel',
                    lastStatus: 'Offline',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
            mockStreamerRepository.findByStreamerId = jest
                .fn()
                .mockResolvedValue(mockStreamers[0]);
            mockYouTubeApiClient.getStream.mockResolvedValue(null);

            await pollingService.pollOnce();

            expect(mockSubscriptionRepository.findAll).toHaveBeenCalled();
            expect(mockYouTubeApiClient.getStream).toHaveBeenCalledWith('UC1234567890123456789012');
        });

        it('should detect stream start and emit streamStarted event', async () => {
            const mockSubscriptions = [
                {
                    id: 'sub1',
                    serverId: 'server1',
                    streamerId: 'UC1234567890123456789012',
                    notificationChannelId: 'channel1',
                    customMessage: null,
                    mentionRoleId: null,
                    embedColor: null,
                    embedFooter: null,
                    notificationMessageId: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockStreamer = {
                id: 'str1',
                streamerId: 'UC1234567890123456789012',
                platform: 'YouTube',
                channelId: 'UC1234567890123456789012',
                username: 'TestChannel',
                lastStatus: 'Offline',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockStreamData = {
                id: 'video123',
                userId: 'UC1234567890123456789012',
                userDisplayName: 'TestChannel',
                title: 'Test Live Stream',
                gameName: null,
                viewerCount: 150,
                startedAt: '2024-01-01T00:00:00Z',
                thumbnailUrl: 'https://example.com/thumb.jpg',
            };

            mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
            mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);
            mockYouTubeApiClient.getStream.mockResolvedValue(mockStreamData);

            const streamStartedSpy = jest.fn();
            eventEmitter.on('streamStarted', streamStartedSpy);

            await pollingService.pollOnce();

            expect(streamStartedSpy).toHaveBeenCalledWith({
                streamer: expect.objectContaining({
                    streamerId: 'UC1234567890123456789012',
                    username: 'TestChannel',
                    channelId: 'UC1234567890123456789012',
                }),
                streamData: expect.objectContaining({
                    title: 'Test Live Stream',
                    viewerCount: 150,
                }),
                subscriptions: expect.arrayContaining([
                    expect.objectContaining({
                        serverId: 'server1',
                        notificationChannelId: 'channel1',
                    }),
                ]),
            });

            expect(mockStreamerRepository.updateStatus).toHaveBeenCalledWith('UC1234567890123456789012', 'Live');
        });

        it('should detect stream end and emit streamEnded event', async () => {
            const mockSubscriptions = [
                {
                    id: 'sub1',
                    serverId: 'server1',
                    streamerId: 'UC1234567890123456789012',
                    notificationChannelId: 'channel1',
                    customMessage: null,
                    mentionRoleId: null,
                    embedColor: null,
                    embedFooter: null,
                    notificationMessageId: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockStreamer = {
                id: 'str1',
                streamerId: 'UC1234567890123456789012',
                platform: 'YouTube',
                channelId: 'UC1234567890123456789012',
                username: 'TestChannel',
                lastStatus: 'Live',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
            mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);
            mockYouTubeApiClient.getStream.mockResolvedValue(null); // No stream data = offline

            const streamEndedSpy = jest.fn();
            eventEmitter.on('streamEnded', streamEndedSpy);

            await pollingService.pollOnce();

            expect(streamEndedSpy).toHaveBeenCalledWith({
                streamer: expect.objectContaining({
                    streamerId: 'UC1234567890123456789012',
                    username: 'TestChannel',
                }),
                subscriptions: expect.arrayContaining([
                    expect.objectContaining({
                        serverId: 'server1',
                    }),
                ]),
            });

            expect(mockStreamerRepository.updateStatus).toHaveBeenCalledWith('UC1234567890123456789012', 'Offline');
        });

        it('should not emit event if stream status has not changed', async () => {
            const mockSubscriptions = [
                {
                    id: 'sub1',
                    serverId: 'server1',
                    streamerId: 'UC1234567890123456789012',
                    notificationChannelId: 'channel1',
                    customMessage: null,
                    mentionRoleId: null,
                    embedColor: null,
                    embedFooter: null,
                    notificationMessageId: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockStreamer = {
                id: 'str1',
                streamerId: 'UC1234567890123456789012',
                platform: 'YouTube',
                channelId: 'UC1234567890123456789012',
                username: 'TestChannel',
                lastStatus: 'Offline',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
            mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);
            mockYouTubeApiClient.getStream.mockResolvedValue(null);

            const streamStartedSpy = jest.fn();
            const streamEndedSpy = jest.fn();
            eventEmitter.on('streamStarted', streamStartedSpy);
            eventEmitter.on('streamEnded', streamEndedSpy);

            await pollingService.pollOnce();

            expect(streamStartedSpy).not.toHaveBeenCalled();
            expect(streamEndedSpy).not.toHaveBeenCalled();
            expect(mockStreamerRepository.updateStatus).not.toHaveBeenCalled();
        });

        it('should handle API errors gracefully for individual streamers', async () => {
            const mockSubscriptions = [
                {
                    id: 'sub1',
                    serverId: 'server1',
                    streamerId: 'UC1234567890123456789012',
                    notificationChannelId: 'channel1',
                    customMessage: null,
                    mentionRoleId: null,
                    embedColor: null,
                    embedFooter: null,
                    notificationMessageId: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockStreamer = {
                id: 'str1',
                streamerId: 'UC1234567890123456789012',
                platform: 'YouTube',
                channelId: 'UC1234567890123456789012',
                username: 'TestChannel',
                lastStatus: 'Offline',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
            mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);
            mockYouTubeApiClient.getStream.mockRejectedValue(new Error('YouTube API error'));

            // Should not throw, just log error
            await expect(pollingService.pollOnce()).resolves.not.toThrow();
        });

        it('should only poll YouTube streamers', async () => {
            const mockSubscriptions = [
                {
                    id: 'sub1',
                    serverId: 'server1',
                    streamerId: 'twitch-user-123',
                    notificationChannelId: 'channel1',
                    customMessage: null,
                    mentionRoleId: null,
                    embedColor: null,
                    embedFooter: null,
                    notificationMessageId: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockStreamer = {
                id: 'str1',
                streamerId: 'twitch-user-123',
                platform: 'Twitch',
                channelId: 'twitchuser',
                username: 'TwitchUser',
                lastStatus: 'Offline',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
            mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);

            await pollingService.pollOnce();

            // Should not call YouTube API for Twitch streamers
            expect(mockYouTubeApiClient.getStream).not.toHaveBeenCalled();
        });
    });

    describe('start and stop', () => {
        it('should start polling at specified interval', () => {
            jest.useFakeTimers();

            pollingService.start(60000); // 1 minute

            expect(pollingService.isRunning()).toBe(true);

            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should stop polling when stop is called', () => {
            jest.useFakeTimers();

            pollingService.start(60000);
            expect(pollingService.isRunning()).toBe(true);

            pollingService.stop();
            expect(pollingService.isRunning()).toBe(false);

            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should not start polling if already running', () => {
            jest.useFakeTimers();

            pollingService.start(60000);
            const firstRun = pollingService.isRunning();

            pollingService.start(60000); // Try to start again
            const secondRun = pollingService.isRunning();

            expect(firstRun).toBe(true);
            expect(secondRun).toBe(true);

            pollingService.stop();
            jest.clearAllTimers();
            jest.useRealTimers();
        });
    });
});
