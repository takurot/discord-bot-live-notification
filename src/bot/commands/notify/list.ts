import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';
import { logger } from '../../../utils/logger';

export async function handleNotifyListCommand(
  interaction: ChatInputCommandInteraction,
  subscriptionRepository: SubscriptionRepository
): Promise<void> {
  logger.info('handleNotifyListCommand started', {
    interactionId: interaction.id,
    guildId: interaction.guildId,
  });

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    logger.info('deferReply succeeded');
  } catch (error) {
    logger.error('deferReply failed', { error });
    throw error;
  }

  const serverId = interaction.guildId;

  if (!serverId) {
    logger.error('Guild ID not found for interaction', { interactionId: interaction.id });
    await interaction.editReply({
      content: '❌ サーバーIDが見つかりませんでした。このコマンドはサーバーでのみ使用できます。',
    });
    return;
  }

  // サーバーの監視リストを取得
  const subscriptions = await subscriptionRepository.findByServerId(serverId);

  if (subscriptions.length === 0) {
    await interaction.editReply({
      content:
        '現在、監視中の配信者はいません。\n`/notify add` コマンドで配信者を追加してください。',
    });
    return;
  }

  // Embedで一覧を表示
  const embed = new EmbedBuilder()
    .setTitle('📺 監視中の配信者一覧')
    .setColor(0x9146ff) // Twitchのブランドカラー
    .setDescription(`現在 ${subscriptions.length} 人の配信者を監視しています。`)
    .setTimestamp();

  // 配信者ごとにフィールドを追加
  subscriptions.forEach((sub, index) => {
    const platformEmoji = sub.streamer.platform === 'Twitch' ? '🎮' : '📺';
    const channelUrl =
      sub.streamer.platform === 'Twitch'
        ? `https://www.twitch.tv/${sub.streamer.channelId}`
        : `https://www.youtube.com/channel/${sub.streamer.channelId}`;

    embed.addFields({
      name: `${platformEmoji} ${index + 1}. ${sub.streamer.username}`,
      value: `プラットフォーム: ${sub.streamer.platform}\nURL: ${channelUrl}`,
      inline: false,
    });
  });

  // フッターに情報を追加
  embed.setFooter({
    text: `無料プラン: ${subscriptions.length}/3枠 使用中`,
  });

  await interaction.editReply({
    embeds: [embed],
  });

  logger.info(`Displayed subscription list for server ${serverId}`, {
    count: subscriptions.length,
  });
}
