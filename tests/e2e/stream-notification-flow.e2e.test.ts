import { EventEmitter } from 'events';
import { Streamer, Subscription } from '@prisma/client';
import { TwitchPollingService } from '../../src/services/polling/TwitchPollingService';
import { NotificationService } from '../../src/services/notification/NotificationService';
import { TwitchStream } from '../../src/services/twitch/TwitchApiClient';
import { SubscriptionRepository } from '../../src/models/repositories/SubscriptionRepository';
import { StreamerRepository } from '../../src/models/repositories/StreamerRepository';
import { TwitchApiClient } from '../../src/services/twitch/TwitchApiClient';
import { Client } from 'discord.js';
import { MockDiscordClient } from './helpers/mockDiscord';

class FakeTwitchApiClient {
  private liveStreams = new Map<string, TwitchStream>();

  setLiveStreams(streams: TwitchStream[]): void {
    this.liveStreams = new Map(streams.map((stream) => [stream.user_id, stream]));
  }

  async getStreams(userIds: string[]): Promise<TwitchStream[]> {
    return userIds
      .map((id) => this.liveStreams.get(id))
      .filter((stream): stream is TwitchStream => Boolean(stream));
  }
}

class InMemoryStreamerRepository {
  constructor(private readonly streamers: Streamer[]) {}

  async findByStreamerId(streamerId: string): Promise<Streamer | null> {
    return this.streamers.find((streamer) => streamer.streamerId === streamerId) ?? null;
  }

  async updateStatus(streamerId: string, status: 'Live' | 'Offline'): Promise<Streamer> {
    const streamer = await this.findByStreamerId(streamerId);
    if (!streamer) {
      throw new Error(`Streamer ${streamerId} not found`);
    }
    streamer.lastStatus = status;
    return streamer;
  }
}

class InMemorySubscriptionRepository {
  constructor(private readonly subscriptions: Subscription[]) {}

  async findAll(): Promise<Subscription[]> {
    return this.subscriptions;
  }

  async updateNotificationMessageId(
    serverId: string,
    streamerId: string,
    messageId: string | null
  ): Promise<Subscription> {
    const subscription = this.subscriptions.find(
      (sub) => sub.serverId === serverId && sub.streamerId === streamerId
    );

    if (!subscription) {
      throw new Error(`Subscription for ${serverId}/${streamerId} not found`);
    }

    subscription.notificationMessageId = messageId;
    return subscription;
  }
}

describe('ストリーム通知E2E', () => {
  const flushAsyncTasks = () => new Promise((resolve) => setImmediate(resolve));

  const buildContext = () => {
    const streamer: Streamer = {
      id: 'streamer-db-id',
      streamerId: 'user-123',
      platform: 'Twitch',
      channelId: 'mockchannel',
      username: 'MockStreamer',
      lastStatus: 'Offline',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    const subscription: Subscription = {
      id: 'sub-123',
      serverId: 'server-123',
      streamerId: 'user-123',
      notificationChannelId: 'channel-123',
      customMessage: '推しが配信を始めたよ！',
      mentionRoleId: null,
      embedColor: null,
      embedFooter: null,
      notificationMessageId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    const subscriptions = [subscription];
    const streamers = [streamer];

    const inMemorySubscriptionRepository = new InMemorySubscriptionRepository(subscriptions);
    const subscriptionRepository =
      inMemorySubscriptionRepository as unknown as SubscriptionRepository;
    const inMemoryStreamerRepository = new InMemoryStreamerRepository(streamers);
    const streamerRepository = inMemoryStreamerRepository as unknown as StreamerRepository;
    const fakeTwitchApiClient = new FakeTwitchApiClient();
    const twitchApiClient = fakeTwitchApiClient as unknown as TwitchApiClient;
    const eventEmitter = new EventEmitter();
    const mockDiscordClient = new MockDiscordClient();

    new NotificationService(mockDiscordClient as unknown as Client, subscriptionRepository, eventEmitter);
    const pollingService = new TwitchPollingService(
      twitchApiClient,
      subscriptionRepository,
      streamerRepository,
      eventEmitter
    );

    return {
      fakeTwitchApiClient,
      pollingService,
      mockDiscordClient,
      subscription,
      streamer,
    };
  };

  it('登録済み配信者の配信開始と終了を通しで検証できる', async () => {
    const { pollingService, fakeTwitchApiClient, mockDiscordClient, subscription, streamer } =
      buildContext();

    const liveStream: TwitchStream = {
      id: 'stream-1',
      user_id: 'user-123',
      user_login: 'mockchannel',
      user_name: 'MockStreamer',
      game_id: 'game-999',
      game_name: 'Valorant',
      type: 'live',
      title: '深夜ランク耐久',
      viewer_count: 12345,
      started_at: new Date('2025-01-01T12:00:00Z').toISOString(),
      language: 'ja',
      thumbnail_url: 'https://cdn.example.com/{width}x{height}.jpg',
      tag_ids: [],
      is_mature: false,
    };

    fakeTwitchApiClient.setLiveStreams([liveStream]);

    await pollingService.pollOnce();
    await flushAsyncTasks();

    const channel = mockDiscordClient.getChannel(subscription.notificationChannelId);
    expect(channel).toBeDefined();
    expect(channel?.getSentCount()).toBe(1);
    const messageAfterStart = channel?.getLastMessage();
    expect(messageAfterStart?.content).toBe('推しが配信を始めたよ！');
    expect(subscription.notificationMessageId).toEqual(messageAfterStart?.id);
    expect(streamer.lastStatus).toBe('Live');

    fakeTwitchApiClient.setLiveStreams([]);

    await pollingService.pollOnce();
    await flushAsyncTasks();

    expect(streamer.lastStatus).toBe('Offline');
    expect(subscription.notificationMessageId).toBeNull();
    const messageAfterEnd = channel?.getLastMessage();
    expect(messageAfterEnd?.content).toContain('⚫');
  });
});
