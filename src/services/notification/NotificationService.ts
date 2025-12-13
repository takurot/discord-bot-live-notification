import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { SubscriptionRepository } from '../../models/repositories/SubscriptionRepository';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { Streamer } from '@prisma/client';
import { StreamProviderStream } from '../common/StreamProvider';
import { StreamEndedEvent, StreamStartedEvent } from '../polling/TwitchPollingService';

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
    this.eventEmitter.on('streamEnded', this.handleStreamEnded.bind(this));
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
    streamData: StreamProviderStream,
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
  private createStreamEmbed(streamer: Streamer, streamData: StreamProviderStream): EmbedBuilder {
    // プラットフォームに応じたURLとカラーを設定
    const platformUrl = streamer.platform === 'YouTube'
      ? `https://www.youtube.com/watch?v=${streamData.id}`
      : `https://www.twitch.tv/${streamer.channelId}`;

    const platformColor = streamer.platform === 'YouTube'
      ? 0xff0000 // YouTube red
      : 0x9146ff; // Twitch purple

    const embed = new EmbedBuilder()
      .setTitle(`🔴 ${streamData.title}`)
      .setURL(platformUrl)
      .setColor(platformColor)
      .addFields(
        {
          name: '配信者',
          value: streamData.userDisplayName,
          inline: true,
        },
        {
          name: 'カテゴリ',
          value: streamData.gameName || 'カテゴリなし',
          inline: true,
        },
        {
          name: '視聴者数',
          value: this.formatViewerCount(streamData.viewerCount),
          inline: true,
        }
      )
      .setTimestamp(new Date(streamData.startedAt));

    // サムネイル画像を設定
    if (streamData.thumbnailUrl) {
      let thumbnailUrl = streamData.thumbnailUrl;
      // Twitchの場合はプレースホルダーを置換
      if (streamer.platform === 'Twitch') {
        thumbnailUrl = thumbnailUrl
          .replace('{width}', '320')
          .replace('{height}', '180');
      }
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

  /**
   * 配信終了イベントを処理
   */
  private async handleStreamEnded(event: StreamEndedEvent): Promise<void> {
    const { streamer, subscriptions } = event;

    logger.info(`Updating notifications for stream end: ${streamer.username}`, {
      streamerId: streamer.streamerId,
      subscriptionCount: subscriptions.length,
    });

    for (const subscription of subscriptions) {
      if (!subscription.notificationMessageId) {
        logger.info('No notification message recorded, skipping stream end update', {
          subscriptionId: subscription.id,
          serverId: subscription.serverId,
        });
        continue;
      }

      try {
        const channel = await this.client.channels.fetch(subscription.notificationChannelId);

        if (!channel) {
          logger.error(
            `Channel not found for stream end update: ${subscription.notificationChannelId}`,
            {
              subscriptionId: subscription.id,
              serverId: subscription.serverId,
            }
          );
          continue;
        }

        if (
          !('messages' in channel) ||
          !channel.messages ||
          typeof channel.messages.fetch !== 'function'
        ) {
          logger.error(
            `Channel does not support message updates: ${subscription.notificationChannelId}`,
            {
              subscriptionId: subscription.id,
              serverId: subscription.serverId,
            }
          );
          continue;
        }

        const message = await channel.messages.fetch(subscription.notificationMessageId);
        await message.edit({
          content: `⚫ ${streamer.username} の配信は終了しました。`,
          embeds: [this.createStreamEndedEmbed(streamer)],
        });

        await this.subscriptionRepository.updateNotificationMessageId(
          subscription.serverId,
          subscription.streamerId,
          null
        );

        logger.info('Notification updated for stream end', {
          subscriptionId: subscription.id,
          channelId: subscription.notificationChannelId,
        });
      } catch (error) {
        logger.error('Failed to update notification on stream end', {
          error,
          subscriptionId: subscription.id,
          channelId: subscription.notificationChannelId,
        });
      }
    }
  }

  /**
   * 配信終了通知のEmbedを生成
   */
  private createStreamEndedEmbed(streamer: Streamer): EmbedBuilder {
    // プラットフォームに応じたURLを設定
    const platformUrl = streamer.platform === 'YouTube'
      ? streamer.channelId.startsWith('@')
        ? `https://www.youtube.com/${streamer.channelId}`
        : `https://www.youtube.com/channel/${streamer.streamerId}`
      : `https://www.twitch.tv/${streamer.channelId}`;

    return new EmbedBuilder()
      .setTitle(`⚫ 配信終了: ${streamer.username}`)
      .setDescription(
        `[${streamer.username}](${platformUrl}) の配信は終了しました。`
      )
      .setColor(0x2f3136)
      .setTimestamp();
  }
}
