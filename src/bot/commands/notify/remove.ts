import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { detectPlatform, parseTwitchUrl, parseYoutubeUrl } from '../../../utils/urlParser';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';
import { logger } from '../../../utils/logger';

export async function handleNotifyRemoveCommand(
  interaction: ChatInputCommandInteraction,
  streamerRepository: StreamerRepository,
  subscriptionRepository: SubscriptionRepository
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
  if (platform === 'Twitch') {
    channelIdentifier = parseTwitchUrl(url);
  } else if (platform === 'YouTube') {
    channelIdentifier = parseYoutubeUrl(url);
  }

  if (!channelIdentifier) {
    await interaction.editReply({
      content: `❌ 無効な${platform} URLです。正しい形式のURLを入力してください。`,
    });
    return;
  }

  // Streamerの存在確認
  const streamer = await streamerRepository.findByPlatformAndChannelId(platform, channelIdentifier);
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
}
