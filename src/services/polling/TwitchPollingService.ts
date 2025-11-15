import { EventEmitter } from 'events';
import { TwitchApiClient, TwitchStream } from '../twitch/TwitchApiClient';
import { SubscriptionRepository, StreamerRepository } from '../../models/repositories';
import { Subscription, Streamer } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface StreamStartedEvent {
  streamer: Streamer;
  streamData: TwitchStream;
  subscriptions: Subscription[];
}

export interface StreamEndedEvent {
  streamer: Streamer;
  subscriptions: Subscription[];
}

export class TwitchPollingService {
  private twitchApiClient: TwitchApiClient;
  private subscriptionRepository: SubscriptionRepository;
  private streamerRepository: StreamerRepository;
  private eventEmitter: EventEmitter;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    twitchApiClient: TwitchApiClient,
    subscriptionRepository: SubscriptionRepository,
    streamerRepository: StreamerRepository,
    eventEmitter: EventEmitter
  ) {
    this.twitchApiClient = twitchApiClient;
    this.subscriptionRepository = subscriptionRepository;
    this.streamerRepository = streamerRepository;
    this.eventEmitter = eventEmitter;
  }

  /**
   * ポーリングを1回実行
   */
  async pollOnce(): Promise<void> {
    try {
      logger.info('Starting polling cycle');

      // 全サブスクリプションを取得
      const subscriptions = await this.subscriptionRepository.findAll();

      if (subscriptions.length === 0) {
        logger.info('No subscriptions found, skipping poll');
        return;
      }

      // ユニークな配信者IDのリストを作成
      const uniqueStreamerIds = Array.from(new Set(subscriptions.map((sub) => sub.streamerId)));

      logger.info(`Polling ${uniqueStreamerIds.length} streamers`);

      // 各配信者の情報を取得
      const streamerMap = new Map<string, Streamer>();
      for (const streamerId of uniqueStreamerIds) {
        const streamer = await this.streamerRepository.findByStreamerId(streamerId);
        if (streamer) {
          streamerMap.set(streamerId, streamer);
        }
      }

      // Twitch APIで配信状態を取得（channelIdで検索）
      const channelIds = Array.from(streamerMap.values())
        .filter((s) => s.platform === 'Twitch')
        .map((s) => s.channelId);

      const liveStreams = await this.twitchApiClient.getStreams(channelIds);
      const liveChannelIds = new Set(liveStreams.map((stream) => stream.user_id));

      logger.info(`Found ${liveStreams.length} live streams`);

      // 各配信者の状態をチェック
      for (const [streamerId, streamer] of streamerMap.entries()) {
        const isLive = liveChannelIds.has(streamer.channelId);
        const wasLive = streamer.lastStatus === 'Live';

        // 配信開始を検知
        if (isLive && !wasLive) {
          const streamData = liveStreams.find((s) => s.user_id === streamer.channelId);
          if (streamData) {
            logger.info(`Stream started: ${streamer.username}`, {
              streamerId,
              channelId: streamer.channelId,
            });

            // 状態を更新
            await this.streamerRepository.updateStatus(streamerId, 'Live');

            // 該当するサブスクリプションを取得
            const relevantSubscriptions = subscriptions.filter(
              (sub) => sub.streamerId === streamerId
            );

            // イベント発行
            this.eventEmitter.emit('streamStarted', {
              streamer: { ...streamer, lastStatus: 'Live' },
              streamData,
              subscriptions: relevantSubscriptions,
            } as StreamStartedEvent);
          }
        }

        // 配信終了を検知
        if (!isLive && wasLive) {
          logger.info(`Stream ended: ${streamer.username}`, {
            streamerId,
            channelId: streamer.channelId,
          });

          // 状態を更新
          await this.streamerRepository.updateStatus(streamerId, 'Offline');

          // 該当するサブスクリプションを取得
          const relevantSubscriptions = subscriptions.filter(
            (sub) => sub.streamerId === streamerId
          );

          // イベント発行
          this.eventEmitter.emit('streamEnded', {
            streamer: { ...streamer, lastStatus: 'Offline' },
            subscriptions: relevantSubscriptions,
          } as StreamEndedEvent);
        }
      }

      logger.info('Polling cycle completed');
    } catch (error) {
      logger.error('Error during polling cycle', { error });
      throw error;
    }
  }

  /**
   * 定期ポーリングを開始
   */
  start(intervalMs: number): void {
    if (this.intervalId) {
      logger.warn('Polling service is already running');
      return;
    }

    logger.info(`Starting polling service with interval: ${intervalMs}ms`);

    // 即座に1回実行
    this.pollOnce().catch((error: unknown) => {
      logger.error('Error in initial poll', { error });
    });

    // 定期実行を設定
    this.intervalId = setInterval(() => {
      this.pollOnce().catch((error: unknown) => {
        logger.error('Error in scheduled poll', { error });
      });
    }, intervalMs);
  }

  /**
   * 定期ポーリングを停止
   */
  stop(): void {
    if (this.intervalId) {
      logger.info('Stopping polling service');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * ポーリングが実行中かどうか
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
