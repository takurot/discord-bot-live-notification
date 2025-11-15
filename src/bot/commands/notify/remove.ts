import { ChatInputCommandInteraction } from 'discord.js';
import { parseTwitchUrl } from '../../../utils/twitchUrlParser';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';
import { logger } from '../../../utils/logger';

export async function handleNotifyRemoveCommand(
  interaction: ChatInputCommandInteraction,
  streamerRepository: StreamerRepository,
  subscriptionRepository: SubscriptionRepository
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const url = interaction.options.getString('url', true);
  const serverId = interaction.guildId;

  if (!serverId) {
    logger.error('Guild ID not found for interaction', { interactionId: interaction.id });
    await interaction.editReply({
      content: '❌ サーバーIDが見つかりませんでした。このコマンドはサーバーでのみ使用できます。',
    });
    return;
  }

  // URLパース
  let channelName: string;
  try {
    channelName = parseTwitchUrl(url);
  } catch (error: any) {
    await interaction.editReply({
      content:
        '❌ 無効なTwitch URLです。正しい形式のURLを入力してください。例: https://www.twitch.tv/channelname',
    });
    return;
  }

  // Streamerの存在確認
  const streamer = await streamerRepository.findByPlatformAndChannelId('Twitch', channelName);
  if (!streamer) {
    await interaction.editReply({
      content: `❌ Twitchで「${channelName}」という配信者を見つけることができませんでした。URLを確認してください。`,
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
    content: `✅ Twitch配信者「${streamer.username}」を監視リストから削除しました。`,
  });
}
