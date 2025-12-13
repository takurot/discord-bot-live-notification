import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { detectPlatform, parseTwitchUrl, parseYoutubeUrl } from '../../../utils/urlParser';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';
import { logger } from '../../../utils/logger';
import { YouTubeApiClient } from '../../../services/youtube/YouTubeApiClient';

import { PubSubHubbubService } from '../../../services/youtube/PubSubHubbubService';

export async function handleNotifyRemoveCommand(
  interaction: ChatInputCommandInteraction,
  streamerRepository: StreamerRepository,
  subscriptionRepository: SubscriptionRepository,
  pubSubHubbubService: PubSubHubbubService | null,
  youtubeApiClient: YouTubeApiClient | null
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const url = interaction.options.getString('url', true);
  const serverId = interaction.guildId;

  if (!serverId) {
    logger.error('Guild ID not found for interaction', { interactionId: interaction.id });
    await interaction.editReply({
      content: '❌ サーバーIDが見つかりませんでした。このコマンドはサーバーでのみ使用できます。',
    });
    return;
  }

  // プラットフォーム判定
  const platform = detectPlatform(url);
  if (!platform) {
    await interaction.editReply({
      content: '❌ 対応していないURLです。TwitchまたはYouTubeのチャンネルURLを入力してください。',
    });
    return;
  }

  // チャンネルID/ハンドル抽出
  let channelIdentifier: string | null = null;
  let canonicalChannelId: string | null = null;

  if (platform === 'Twitch') {
    channelIdentifier = parseTwitchUrl(url);
  } else if (platform === 'YouTube') {
    channelIdentifier = parseYoutubeUrl(url);
    if (channelIdentifier && channelIdentifier.startsWith('UC')) {
      canonicalChannelId = channelIdentifier;
    }
  }

  if (!channelIdentifier) {
    await interaction.editReply({
      content: `❌ 無効な${platform} URLです。正しい形式のURLを入力してください。`,
    });
    return;
  }

  if (platform === 'YouTube') {
    if (!youtubeApiClient) {
      await interaction.editReply({
        content: '❌ YouTube連携が有効になっていません。',
      });
      return;
    }

    if (!canonicalChannelId) {
      try {
        const user = await youtubeApiClient.getUser(channelIdentifier);
        if (!user) {
          await interaction.editReply({
            content: `❌ YouTubeで「${channelIdentifier}」という配信者を見つけることができませんでした。URLを確認してください。`,
          });
          return;
        }
        canonicalChannelId = user.id;
      } catch (error) {
        logger.error('Failed to resolve YouTube channel identifier for removal', {
          error,
          channelIdentifier,
        });
        await interaction.editReply({
          content: '❌ YouTubeチャンネル情報の取得に失敗しました。時間を置いて再度お試しください。',
        });
        return;
      }
    }
  } else {
    canonicalChannelId = channelIdentifier;
  }

  if (!canonicalChannelId) {
    logger.error('Resolved channel ID is empty during notify remove', {
      platform,
      channelIdentifier,
    });
    await interaction.editReply({
      content: '❌ 配信者情報の解決に失敗しました。URLをご確認のうえ再度お試しください。',
    });
    return;
  }

  // Streamerの存在確認
  const streamer = await streamerRepository.findByPlatformAndChannelId(
    platform,
    canonicalChannelId,
    {
      streamerId: platform === 'YouTube' ? canonicalChannelId : undefined,
      additionalChannelIds:
        platform === 'YouTube' && channelIdentifier !== canonicalChannelId
          ? [channelIdentifier]
          : [],
    }
  );
  if (!streamer) {
    await interaction.editReply({
      content: `❌ ${platform}で「${channelIdentifier}」という配信者を見つけることができませんでした。URLを確認してください。`,
    });
    return;
  }

  // Subscriptionの存在確認
  const subscription = await subscriptionRepository.findByServerAndStreamer(
    serverId,
    streamer.streamerId
  );
  if (!subscription) {
    await interaction.editReply({
      content: `❌ 「${streamer.username}」は監視リストに登録されていません。`,
    });
    return;
  }

  // Subscription削除
  await subscriptionRepository.delete(serverId, streamer.streamerId);
  logger.info(`Subscription removed for server ${serverId} to streamer ${streamer.username}`);

  await interaction.editReply({
    content: `✅ ${platform}配信者「${streamer.username}」を監視リストから削除しました。`,
  });

  // PubSubHubbub購読解除 (YouTubeのみ)
  // 他のサーバーでも登録されていないか確認してから解除する
  if (platform === 'YouTube' && pubSubHubbubService) {
    const remainingSubscriptions = await subscriptionRepository.countByStreamerId(
      streamer.streamerId
    );
    if (remainingSubscriptions === 0) {
      try {
        await pubSubHubbubService.unsubscribe(streamer.streamerId);
      } catch (error) {
        console.error(`Failed to unsubscribe from PubSubHubbub for ${streamer.streamerId}:`, error);
      }
    }
  }
}
