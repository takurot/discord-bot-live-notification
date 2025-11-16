import { TwitchPollingService } from './TwitchPollingService';
import { TwitchApiClient } from '../twitch/TwitchApiClient';
import {
  SubscriptionRepository,
  StreamerRepository,
} from '../../models/repositories';
import { EventEmitter } from 'events';

// モックの設定
jest.mock('../twitch/TwitchApiClient');
jest.mock('../../models/repositories');

describe('TwitchPollingService', () => {
  let pollingService: TwitchPollingService;
  let mockTwitchApiClient: jest.Mocked<TwitchApiClient>;
  let mockSubscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let mockStreamerRepository: jest.Mocked<StreamerRepository>;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    mockTwitchApiClient = new TwitchApiClient(
      'test-client-id',
      'test-client-secret',
    ) as jest.Mocked<TwitchApiClient>;
    mockSubscriptionRepository =
      new SubscriptionRepository(null as any) as jest.Mocked<SubscriptionRepository>;
    mockStreamerRepository =
      new StreamerRepository(null as any) as jest.Mocked<StreamerRepository>;
    eventEmitter = new EventEmitter();

    pollingService = new TwitchPollingService(
      mockTwitchApiClient,
      mockSubscriptionRepository,
      mockStreamerRepository,
      eventEmitter,
    );

    // デフォルトのモック実装
    mockSubscriptionRepository.findAll = jest.fn().mockResolvedValue([]);
    mockStreamerRepository.updateStatus = jest.fn().mockResolvedValue({});
    mockTwitchApiClient.getStreams = jest.fn().mockResolvedValue([]);
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
          streamerId: 'streamer1',
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
          streamerId: 'streamer1',
          platform: 'Twitch',
          channelId: 'test_channel',
          username: 'TestUser',
          lastStatus: 'Offline',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
      mockStreamerRepository.findByStreamerId = jest
        .fn()
        .mockResolvedValue(mockStreamers[0]);
      mockTwitchApiClient.getStreams.mockResolvedValue([]);

      await pollingService.pollOnce();

      expect(mockSubscriptionRepository.findAll).toHaveBeenCalled();
      expect(mockTwitchApiClient.getStreams).toHaveBeenCalledWith(['streamer1']);
    });

    it('should detect stream start and emit streamStarted event', async () => {
      const mockSubscriptions = [
        {
          id: 'sub1',
          serverId: 'server1',
          streamerId: 'streamer1',
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
        streamerId: 'streamer1',
        platform: 'Twitch',
        channelId: 'test_channel',
        username: 'TestUser',
        lastStatus: 'Offline',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStreamData = [
        {
          id: 'stream1',
          user_id: 'streamer1',
          user_login: 'testuser',
          user_name: 'TestUser',
          game_id: '12345',
          game_name: 'Just Chatting',
          type: 'live',
          title: 'Test Stream',
          viewer_count: 100,
          started_at: '2024-01-01T00:00:00Z',
          language: 'en',
          thumbnail_url: 'https://example.com/thumb.jpg',
          tag_ids: [],
          is_mature: false,
        },
      ];

      mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
      mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);
      mockTwitchApiClient.getStreams.mockResolvedValue(mockStreamData);

      const streamStartedSpy = jest.fn();
      eventEmitter.on('streamStarted', streamStartedSpy);

      await pollingService.pollOnce();

      expect(streamStartedSpy).toHaveBeenCalledWith({
        streamer: expect.objectContaining({
          streamerId: 'streamer1',
          username: 'TestUser',
          channelId: 'test_channel',
        }),
        streamData: expect.objectContaining({
          title: 'Test Stream',
          game_name: 'Just Chatting',
          viewer_count: 100,
        }),
        subscriptions: expect.arrayContaining([
          expect.objectContaining({
            serverId: 'server1',
            notificationChannelId: 'channel1',
          }),
        ]),
      });

      expect(mockStreamerRepository.updateStatus).toHaveBeenCalledWith('streamer1', 'Live');
    });

    it('should detect stream end and emit streamEnded event', async () => {
      const mockSubscriptions = [
        {
          id: 'sub1',
          serverId: 'server1',
          streamerId: 'streamer1',
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
        streamerId: 'streamer1',
        platform: 'Twitch',
        channelId: 'test_channel',
        username: 'TestUser',
        lastStatus: 'Live',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
      mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);
      mockTwitchApiClient.getStreams.mockResolvedValue([]); // No stream data = offline

      const streamEndedSpy = jest.fn();
      eventEmitter.on('streamEnded', streamEndedSpy);

      await pollingService.pollOnce();

      expect(streamEndedSpy).toHaveBeenCalledWith({
        streamer: expect.objectContaining({
          streamerId: 'streamer1',
          username: 'TestUser',
        }),
        subscriptions: expect.arrayContaining([
          expect.objectContaining({
            serverId: 'server1',
          }),
        ]),
      });

      expect(mockStreamerRepository.updateStatus).toHaveBeenCalledWith('streamer1', 'Offline');
    });

    it('should not emit event if stream status has not changed', async () => {
      const mockSubscriptions = [
        {
          id: 'sub1',
          serverId: 'server1',
          streamerId: 'streamer1',
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
        streamerId: 'streamer1',
        platform: 'Twitch',
        channelId: 'test_channel',
        username: 'TestUser',
        lastStatus: 'Offline',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSubscriptionRepository.findAll.mockResolvedValue(mockSubscriptions);
      mockStreamerRepository.findByStreamerId = jest.fn().mockResolvedValue(mockStreamer);
      mockTwitchApiClient.getStreams.mockResolvedValue([]);

      const streamStartedSpy = jest.fn();
      const streamEndedSpy = jest.fn();
      eventEmitter.on('streamStarted', streamStartedSpy);
      eventEmitter.on('streamEnded', streamEndedSpy);

      await pollingService.pollOnce();

      expect(streamStartedSpy).not.toHaveBeenCalled();
      expect(streamEndedSpy).not.toHaveBeenCalled();
      expect(mockStreamerRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockSubscriptionRepository.findAll.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(pollingService.pollOnce()).rejects.toThrow('Database error');
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

