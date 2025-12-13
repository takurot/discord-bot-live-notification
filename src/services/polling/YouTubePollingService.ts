import { EventEmitter } from 'events';
import { YouTubeApiClient } from '../youtube/YouTubeApiClient';
import { SubscriptionRepository, StreamerRepository } from '../../models/repositories';
import { Subscription, Streamer } from '@prisma/client';
import { logger } from '../../utils/logger';
import { StreamProviderStream } from '../common/StreamProvider';

export interface StreamStartedEvent {
  streamer: Streamer;
  streamData: StreamProviderStream;
  subscriptions: Subscription[];
}

export interface StreamEndedEvent {
  streamer: Streamer;
  subscriptions: Subscription[];
}

export class YouTubePollingService {
  private youtubeApiClient: YouTubeApiClient;
  private subscriptionRepository: SubscriptionRepository;
  private streamerRepository: StreamerRepository;
  private eventEmitter: EventEmitter;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    youtubeApiClient: YouTubeApiClient,
    subscriptionRepository: SubscriptionRepository,
    streamerRepository: StreamerRepository,
    eventEmitter: EventEmitter
  ) {
    this.youtubeApiClient = youtubeApiClient;
    this.subscriptionRepository = subscriptionRepository;
    this.streamerRepository = streamerRepository;
    this.eventEmitter = eventEmitter;
  }

  /**
   * ポーリングを1回実行
   */
  async pollOnce(): Promise<void> {
    try {
      logger.info('Starting YouTube polling cycle');

      // 全サブスクリプションを取得
      const subscriptions = await this.subscriptionRepository.findAll();

      if (subscriptions.length === 0) {
        logger.info('No subscriptions found, skipping YouTube poll');
        return;
      }

      // ユニークな配信者IDのリストを作成
      const uniqueStreamerIds = Array.from(new Set(subscriptions.map((sub) => sub.streamerId)));

      // 各配信者の情報を取得
      const streamerMap = new Map<string, Streamer>();
      for (const streamerId of uniqueStreamerIds) {
        const streamer = await this.streamerRepository.findByStreamerId(streamerId);
        if (streamer && streamer.platform === 'YouTube') {
          streamerMap.set(streamerId, streamer);
        }
      }

      if (streamerMap.size === 0) {
        logger.info('No YouTube streamers to poll');
        return;
      }

      logger.info(`Polling ${streamerMap.size} YouTube streamers`);

      // 各配信者の状態をチェック
      for (const [streamerId, streamer] of streamerMap.entries()) {
        try {
          // YouTube APIで配信状態を取得
          const streamData = await this.youtubeApiClient.getStream(streamer.streamerId);
          const isLive = streamData !== null;
          const wasLive = streamer.lastStatus === 'Live';

          // 配信開始を検知
          if (isLive && !wasLive && streamData) {
            logger.info(`YouTube stream started: ${streamer.username}`, {
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

          // 配信終了を検知
          if (!isLive && wasLive) {
            logger.info(`YouTube stream ended: ${streamer.username}`, {
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
        } catch (error) {
          logger.error(`Error checking YouTube stream status for ${streamer.username}`, {
            error,
            streamerId,
          });
          // Continue with other streamers even if one fails
        }
      }

      logger.info('YouTube polling cycle completed');
    } catch (error) {
      logger.error('Error during YouTube polling cycle', { error });
      throw error;
    }
  }

  /**
   * 定期ポーリングを開始
   */
  start(intervalMs: number): void {
    if (this.intervalId) {
      logger.warn('YouTube polling service is already running');
      return;
    }

    logger.info(`Starting YouTube polling service with interval: ${intervalMs}ms`);

    // 即座に1回実行
    this.pollOnce().catch((error: unknown) => {
      logger.error('Error in initial YouTube poll', { error });
    });

    // 定期実行を設定
    this.intervalId = setInterval(() => {
      this.pollOnce().catch((error: unknown) => {
        logger.error('Error in scheduled YouTube poll', { error });
      });
    }, intervalMs);
  }

  /**
   * 定期ポーリングを停止
   */
  stop(): void {
    if (this.intervalId) {
      logger.info('Stopping YouTube polling service');
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
