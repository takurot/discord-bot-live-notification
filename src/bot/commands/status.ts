import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { ServerRepository } from '../../models/repositories/ServerRepository';
import { SubscriptionRepository } from '../../models/repositories/SubscriptionRepository';
import { logger } from '../../utils/logger';

/**
 * 稼働時間をフォーマット
 */
function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}日 ${hours % 24}時間 ${minutes % 60}分`;
  } else if (hours > 0) {
    return `${hours}時間 ${minutes % 60}分`;
  } else if (minutes > 0) {
    return `${minutes}分 ${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export async function handleStatusCommand(
  interaction: ChatInputCommandInteraction,
  serverRepository: ServerRepository,
  subscriptionRepository: SubscriptionRepository
): Promise<void> {
  // 統計情報を取得
  const servers = await serverRepository.findAll();
  const subscriptions = await subscriptionRepository.findAll();

  // ユニークな配信者数を計算
  const uniqueStreamers = new Set(subscriptions.map((sub) => sub.streamerId)).size;

  // 稼働時間を計算
  const uptime = interaction.client.readyAt ? Date.now() - interaction.client.readyAt.getTime() : 0;
  const uptimeFormatted = formatUptime(uptime);

  // 接続中のサーバー数（キャッシュから）
  const connectedServers = interaction.client.guilds.cache.size;

  // Embedを作成
  const embed = new EmbedBuilder()
    .setTitle('🤖 StreamPulse ステータス')
    .setColor(0x9146ff) // Twitch purple
    .addFields(
      {
        name: '⏱️ 稼働時間',
        value: uptimeFormatted,
        inline: true,
      },
      {
        name: '🏠 接続サーバー数',
        value: `${connectedServers}サーバー`,
        inline: true,
      },
      {
        name: '📊 DB登録サーバー数',
        value: `${servers.length}サーバー`,
        inline: true,
      },
      {
        name: '📺 監視中の配信者',
        value: `${uniqueStreamers}人`,
        inline: true,
      },
      {
        name: '📬 総登録数',
        value: `${subscriptions.length}件`,
        inline: true,
      },
      {
        name: '💾 プラン内訳',
        value: `Free: ${servers.filter((s) => s.planType === 'Free').length}  |  Pro: ${servers.filter((s) => s.planType === 'Pro').length}`,
        inline: true,
      }
    )
    .setFooter({
      text: 'StreamPulse - Twitch & YouTube 配信通知Bot',
    })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });

  logger.info('Status command executed', {
    userId: interaction.user.id,
    servers: servers.length,
    subscriptions: subscriptions.length,
  });
}
