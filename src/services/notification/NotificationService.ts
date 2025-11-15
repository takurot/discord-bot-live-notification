import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { SubscriptionRepository } from '../../models/repositories/SubscriptionRepository';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { Streamer } from '@prisma/client';
import { TwitchStream } from '../twitch/TwitchApiClient';
import { StreamStartedEvent } from '../polling/TwitchPollingService';

export class NotificationService {
  private client: Client;
  private subscriptionRepository: SubscriptionRepository;
  private eventEmitter: EventEmitter;

  constructor(
    client: Client,
    subscriptionRepository: SubscriptionRepository,
    eventEmitter: EventEmitter
  ) {
    this.client = client;
    this.subscriptionRepository = subscriptionRepository;
    this.eventEmitter = eventEmitter;

    // イベントリスナーを登録
    this.eventEmitter.on('streamStarted', this.handleStreamStarted.bind(this));
  }

  /**
   * 配信開始イベントを処理
   */
  private async handleStreamStarted(event: StreamStartedEvent): Promise<void> {
    const { streamer, streamData, subscriptions } = event;

    logger.info(`Sending notifications for stream start: ${streamer.username}`, {
      streamerId: streamer.streamerId,
      subscriptionCount: subscriptions.length,
    });

    // 各サブスクリプションに通知を送信
    for (const subscription of subscriptions) {
      try {
        await this.sendNotification(streamer, streamData, subscription);
      } catch (error: unknown) {
        logger.error(`Failed to send notification for subscription ${subscription.id}`, {
          error,
          serverId: subscription.serverId,
          channelId: subscription.notificationChannelId,
        });
      }
    }
  }

  /**
   * 通知を送信
   */
  private async sendNotification(
    streamer: Streamer,
    streamData: TwitchStream,
    subscription: {
      id: string;
      serverId: string;
      streamerId: string;
      notificationChannelId: string;
      customMessage: string | null;
      mentionRoleId: string | null;
    }
  ): Promise<void> {
    // チャンネルを取得
    const channel = await this.client.channels.fetch(subscription.notificationChannelId);

    if (!channel) {
      logger.error(`Channel not found: ${subscription.notificationChannelId}`, {
        subscriptionId: subscription.id,
        serverId: subscription.serverId,
      });
      return;
    }

    // テキストチャンネルかどうかをチェック（より柔軟な型チェック）
    if (!('send' in channel) || typeof channel.send !== 'function') {
      logger.error(
        `Channel does not support sending messages: ${subscription.notificationChannelId}`,
        {
          subscriptionId: subscription.id,
          serverId: subscription.serverId,
        }
      );
      return;
    }

    // Embedを生成
    const embed = this.createStreamEmbed(streamer, streamData);

    // メッセージ内容を構築
    let content: string | undefined = undefined;
    if (subscription.mentionRoleId) {
      content = `<@&${subscription.mentionRoleId}>`;
    } else if (subscription.customMessage) {
      content = subscription.customMessage;
    }

    // 通知を送信（型アサーション）
    const message = await (channel as TextChannel).send({
      content,
      embeds: [embed],
    });

    logger.info(`Notification sent successfully`, {
      messageId: message.id,
      subscriptionId: subscription.id,
      channelId: subscription.notificationChannelId,
    });

    // 通知メッセージIDをDBに保存
    await this.subscriptionRepository.updateNotificationMessageId(
      subscription.serverId,
      subscription.streamerId,
      message.id
    );
  }

  /**
   * 配信通知Embedを生成
   */
  private createStreamEmbed(_streamer: Streamer, streamData: TwitchStream): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🔴 ${streamData.title}`)
      .setURL(`https://www.twitch.tv/${streamData.user_login}`)
      .setColor(0x9146ff) // Twitch purple
      .addFields(
        {
          name: '配信者',
          value: streamData.user_name,
          inline: true,
        },
        {
          name: 'カテゴリ',
          value: streamData.game_name || 'カテゴリなし',
          inline: true,
        },
        {
          name: '視聴者数',
          value: this.formatViewerCount(streamData.viewer_count),
          inline: true,
        }
      )
      .setTimestamp(new Date(streamData.started_at));

    // サムネイル画像を設定
    if (streamData.thumbnail_url) {
      const thumbnailUrl = streamData.thumbnail_url
        .replace('{width}', '320')
        .replace('{height}', '180');
      embed.setThumbnail(thumbnailUrl);
    }

    return embed;
  }

  /**
   * 視聴者数をフォーマット
   */
  private formatViewerCount(count: number): string {
    return `${count.toLocaleString('ja-JP')}人`;
  }
}
