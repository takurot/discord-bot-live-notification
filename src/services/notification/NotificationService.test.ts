import { NotificationService } from './NotificationService';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { SubscriptionRepository } from '../../models/repositories/SubscriptionRepository';
import { EventEmitter } from 'events';
import { Subscription, Streamer } from '@prisma/client';
import { StreamProviderStream } from '../common/StreamProvider';
import { StreamEndedEvent, StreamStartedEvent } from '../polling/TwitchPollingService';

// モックの設定
jest.mock('../../models/repositories/SubscriptionRepository');

// discord.jsは部分的にモックし、EmbedBuilderは実物を使う
jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  return {
    ...actual,
    Client: jest.fn(),
    TextChannel: jest.fn(),
  };
});

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockClient: jest.Mocked<Client>;
  let mockSubscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let eventEmitter: EventEmitter;

  const mockStreamer: Streamer = {
    id: 'str1',
    streamerId: 'streamer1',
    platform: 'Twitch',
    channelId: 'test_channel',
    username: 'TestUser',
    lastStatus: 'Live',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStreamData: StreamProviderStream = {
    id: 'stream123',
    userId: 'user123',
    userDisplayName: 'TestUser',
    title: 'Test Stream',
    gameName: 'Just Chatting',
    viewerCount: 100,
    startedAt: '2024-01-01T00:00:00Z',
    thumbnailUrl: 'https://example.com/thumb.jpg',
  };

  const mockSubscription: Subscription = {
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
  };

  beforeEach(() => {
    const mockFetch = jest.fn();
    mockClient = {
      channels: {
        fetch: mockFetch,
      },
    } as unknown as jest.Mocked<Client>;

    // fetchをモック関数として扱えるようにする
    (mockClient.channels.fetch as jest.Mock) = mockFetch;

    mockSubscriptionRepository = new SubscriptionRepository(
      {} as any
    ) as jest.Mocked<SubscriptionRepository>;
    mockSubscriptionRepository.updateNotificationMessageId = jest.fn().mockResolvedValue(undefined);

    eventEmitter = new EventEmitter();

    notificationService = new NotificationService(
      mockClient,
      mockSubscriptionRepository,
      eventEmitter
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('streamStarted event handling', () => {
    it('should send notification to Discord channel when stream starts', async () => {
      const mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'message123' }),
      } as unknown as jest.Mocked<TextChannel>;

      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const event: StreamStartedEvent = {
        streamer: mockStreamer,
        streamData: mockStreamData,
        subscriptions: [mockSubscription],
      };

      // イベントを発行
      eventEmitter.emit('streamStarted', event);

      // 非同期処理を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel1');
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: undefined,
        embeds: [expect.any(EmbedBuilder)],
      });
      expect(mockSubscriptionRepository.updateNotificationMessageId).toHaveBeenCalledWith(
        'server1',
        'streamer1',
        'message123'
      );
    });

    it('should send notification with custom message if specified', async () => {
      const mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'message123' }),
      } as unknown as jest.Mocked<TextChannel>;

      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const customSubscription = {
        ...mockSubscription,
        customMessage: '@everyone TestUserが配信を開始しました！',
      };

      const event: StreamStartedEvent = {
        streamer: mockStreamer,
        streamData: mockStreamData,
        subscriptions: [customSubscription],
      };

      eventEmitter.emit('streamStarted', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockChannel.send).toHaveBeenCalledWith({
        content: '@everyone TestUserが配信を開始しました！',
        embeds: [expect.any(EmbedBuilder)],
      });
    });

    it('should send notification with role mention if specified', async () => {
      const mockChannel = {
        send: jest.fn().mockResolvedValue({ id: 'message123' }),
      } as unknown as jest.Mocked<TextChannel>;

      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const roleSubscription = {
        ...mockSubscription,
        mentionRoleId: 'role123',
      };

      const event: StreamStartedEvent = {
        streamer: mockStreamer,
        streamData: mockStreamData,
        subscriptions: [roleSubscription],
      };

      eventEmitter.emit('streamStarted', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockChannel.send).toHaveBeenCalledWith({
        content: '<@&role123>',
        embeds: [expect.any(EmbedBuilder)],
      });
    });

    it('should send notifications to multiple channels for multiple subscriptions', async () => {
      const mockChannel1 = {
        send: jest.fn().mockResolvedValue({ id: 'message123' }),
      } as unknown as jest.Mocked<TextChannel>;

      const mockChannel2 = {
        send: jest.fn().mockResolvedValue({ id: 'message456' }),
      } as unknown as jest.Mocked<TextChannel>;

      (mockClient.channels.fetch as jest.Mock)
        .mockResolvedValueOnce(mockChannel1)
        .mockResolvedValueOnce(mockChannel2);

      const subscription2: Subscription = {
        ...mockSubscription,
        id: 'sub2',
        serverId: 'server2',
        notificationChannelId: 'channel2',
      };

      const event: StreamStartedEvent = {
        streamer: mockStreamer,
        streamData: mockStreamData,
        subscriptions: [mockSubscription, subscription2],
      };

      eventEmitter.emit('streamStarted', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockClient.channels.fetch).toHaveBeenCalledTimes(2);
      expect(mockChannel1.send).toHaveBeenCalled();
      expect(mockChannel2.send).toHaveBeenCalled();
      expect(mockSubscriptionRepository.updateNotificationMessageId).toHaveBeenCalledTimes(2);
    });

    it('should handle channel not found error gracefully', async () => {
      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(null);

      const event: StreamStartedEvent = {
        streamer: mockStreamer,
        streamData: mockStreamData,
        subscriptions: [mockSubscription],
      };

      eventEmitter.emit('streamStarted', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel1');
      expect(mockSubscriptionRepository.updateNotificationMessageId).not.toHaveBeenCalled();
    });

    it('should handle message send error gracefully', async () => {
      const mockChannel = {
        send: jest.fn().mockRejectedValue(new Error('Missing Permissions')),
      } as unknown as jest.Mocked<TextChannel>;

      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const event: StreamStartedEvent = {
        streamer: mockStreamer,
        streamData: mockStreamData,
        subscriptions: [mockSubscription],
      };

      eventEmitter.emit('streamStarted', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockSubscriptionRepository.updateNotificationMessageId).not.toHaveBeenCalled();
    });
  });

  describe('streamEnded event handling', () => {
    it('should update existing notification message when stream ends', async () => {
      const mockMessage = {
        edit: jest.fn().mockResolvedValue(undefined),
      };
      const mockChannel = {
        messages: {
          fetch: jest.fn().mockResolvedValue(mockMessage),
        },
      } as unknown as jest.Mocked<TextChannel>;

      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const subscriptionWithMessage: Subscription = {
        ...mockSubscription,
        notificationMessageId: 'message123',
      };

      const event: StreamEndedEvent = {
        streamer: mockStreamer,
        subscriptions: [subscriptionWithMessage],
      };

      eventEmitter.emit('streamEnded', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel1');
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('message123');
      expect(mockMessage.edit).toHaveBeenCalledWith({
        content: expect.stringContaining('配信は終了しました'),
        embeds: [expect.any(EmbedBuilder)],
      });
      expect(mockSubscriptionRepository.updateNotificationMessageId).toHaveBeenCalledWith(
        'server1',
        'streamer1',
        null
      );
    });

    it('should skip update when notificationMessageId is missing', async () => {
      const event: StreamEndedEvent = {
        streamer: mockStreamer,
        subscriptions: [mockSubscription],
      };

      eventEmitter.emit('streamEnded', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
      expect(mockSubscriptionRepository.updateNotificationMessageId).not.toHaveBeenCalled();
    });

    it('should handle message fetch errors gracefully', async () => {
      const mockChannel = {
        messages: {
          fetch: jest.fn().mockRejectedValue(new Error('Unknown Message')),
        },
      } as unknown as jest.Mocked<TextChannel>;

      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const subscriptionWithMessage: Subscription = {
        ...mockSubscription,
        notificationMessageId: 'message123',
      };

      const event: StreamEndedEvent = {
        streamer: mockStreamer,
        subscriptions: [subscriptionWithMessage],
      };

      eventEmitter.emit('streamEnded', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('message123');
      expect(mockSubscriptionRepository.updateNotificationMessageId).not.toHaveBeenCalled();
    });
  });

  describe('createStreamEmbed', () => {
    it('should create embed with correct stream information', () => {
      const embed = (notificationService as any).createStreamEmbed(mockStreamer, mockStreamData);

      expect(embed.data.title).toBe('🔴 Test Stream');
      expect(embed.data.url).toBe('https://www.twitch.tv/test_channel');
      expect(embed.data.color).toBe(0x9146ff); // Twitch purple
      expect(embed.data.thumbnail?.url).toBe('https://example.com/thumb.jpg');
      expect(embed.data.fields).toHaveLength(3);
      expect(embed.data.fields?.[0].name).toBe('配信者');
      expect(embed.data.fields?.[0].value).toBe('TestUser');
      expect(embed.data.fields?.[1].name).toBe('カテゴリ');
      expect(embed.data.fields?.[1].value).toBe('Just Chatting');
      expect(embed.data.fields?.[2].name).toBe('視聴者数');
      expect(embed.data.fields?.[2].value).toBe('100人');
    });

    it('should format large viewer count correctly', () => {
      const largeViewerStreamData = {
        ...mockStreamData,
        viewerCount: 12345,
      };

      const embed = (notificationService as any).createStreamEmbed(
        mockStreamer,
        largeViewerStreamData
      );

      expect(embed.data.fields?.[2].value).toBe('12,345人');
    });

    it('should handle missing game name', () => {
      const noGameStreamData = {
        ...mockStreamData,
        gameName: null,
      };

      const embed = (notificationService as any).createStreamEmbed(mockStreamer, noGameStreamData);

      expect(embed.data.fields?.[1].value).toBe('カテゴリなし');
    });
  });
});
