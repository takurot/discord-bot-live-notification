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

// MVP総合確認用のテスト
// Phase 1で実装した全機能（Twitch配信検知、通知送信、配信終了更新）が
// 期待通りに連携して動作することを確認する

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

describe('MVP総合動作確認 (P1-T19)', () => {
  const flushAsyncTasks = () => new Promise((resolve) => setImmediate(resolve));

  const buildContext = () => {
    // テストデータ: 配信者
    const streamer: Streamer = {
      id: 'streamer-mvp-1',
      streamerId: 'user-mvp',
      platform: 'Twitch',
      channelId: 'mvp_channel',
      username: 'MVP Streamer',
      lastStatus: 'Offline',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // テストデータ: サブスクリプション（カスタムメッセージあり）
    const subscription: Subscription = {
      id: 'sub-mvp-1',
      serverId: 'server-mvp',
      streamerId: 'user-mvp',
      notificationChannelId: 'channel-mvp',
      customMessage: 'MVPテスト配信開始！',
      mentionRoleId: 'role-mvp',
      embedColor: null,
      embedFooter: null,
      notificationMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const subscriptions = [subscription];
    const streamers = [streamer];

    // モックリポジトリとAPIクライアント
    const subscriptionRepository = new InMemorySubscriptionRepository(
      subscriptions
    ) as unknown as SubscriptionRepository;
    const streamerRepository = new InMemoryStreamerRepository(
      streamers
    ) as unknown as StreamerRepository;
    const fakeTwitchApiClient = new FakeTwitchApiClient();
    const twitchApiClient = fakeTwitchApiClient as unknown as TwitchApiClient;
    const eventEmitter = new EventEmitter();
    const mockDiscordClient = new MockDiscordClient();

    // サービスの初期化
    new NotificationService(
      mockDiscordClient as unknown as Client,
      subscriptionRepository,
      eventEmitter
    );
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

  it('MVP機能総合: 配信開始検知 -> 通知送信(メンション/カスタムmsg) -> 配信終了検知 -> 通知更新', async () => {
    const { pollingService, fakeTwitchApiClient, mockDiscordClient, subscription, streamer } =
      buildContext();

    // 1. 配信開始データセットアップ
    const liveStream: TwitchStream = {
      id: 'stream-mvp-live',
      user_id: 'user-mvp',
      user_login: 'mvp_channel',
      user_name: 'MVP Streamer',
      game_id: 'game-mvp',
      game_name: 'Apex Legends',
      type: 'live',
      title: 'MVP検証配信',
      viewer_count: 100,
      started_at: new Date().toISOString(),
      language: 'ja',
      thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      tag_ids: [],
      is_mature: false,
    };

    fakeTwitchApiClient.setLiveStreams([liveStream]);

    // 2. ポーリング実行（配信開始検知）
    await pollingService.pollOnce();
    await flushAsyncTasks();

    // 検証: 通知が送信されたか
    const channel = mockDiscordClient.getChannel(subscription.notificationChannelId);
    expect(channel).toBeDefined();
    expect(channel?.getSentCount()).toBe(1);

    const sentMessage = channel?.getLastMessage();
    // メンションが含まれているか確認
    expect(sentMessage?.content).toContain('<@&role-mvp>');
    // Embedの内容確認
    expect(sentMessage?.embeds[0].data.title).toContain('MVP検証配信');
    expect(sentMessage?.embeds[0].data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '配信者', value: 'MVP Streamer' }),
        expect.objectContaining({ name: 'カテゴリ', value: 'Apex Legends' }),
      ])
    );

    // DB状態確認: NotificationMessageIdが保存されたか
    expect(subscription.notificationMessageId).toBe(sentMessage?.id);
    // DB状態確認: 配信ステータスがLiveになったか
    expect(streamer.lastStatus).toBe('Live');

    // 3. 配信終了データセットアップ
    fakeTwitchApiClient.setLiveStreams([]);

    // 4. ポーリング実行（配信終了検知）
    await pollingService.pollOnce();
    await flushAsyncTasks();

    // 検証: 通知メッセージが更新されたか
    const updatedMessage = await channel?.messages.fetch(sentMessage!.id);
    expect(updatedMessage?.content).toContain('⚫ MVP Streamer の配信は終了しました。');
    expect(updatedMessage?.embeds[0].data.title).toBe('⚫ 配信終了: MVP Streamer');

    // DB状態確認: NotificationMessageIdがクリアされたか（null）
    expect(subscription.notificationMessageId).toBeNull();
    // DB状態確認: 配信ステータスがOfflineになったか
    expect(streamer.lastStatus).toBe('Offline');
  });
});

