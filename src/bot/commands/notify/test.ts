import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { createLiveNotificationEmbed } from '../../../utils/notificationEmbed';
import { logger } from '../../../utils/logger';

export async function handleNotifyTestCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // テスト用のダミーデータ
  const testData = {
    platform: 'Twitch' as const,
    username: 'TestStreamer',
    streamTitle: 'これはテスト通知です！実際の配信開始時にはこのような通知が送信されます。',
    game: 'Apex Legends',
    thumbnailUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/511224-285x380.jpg',
    streamUrl: 'https://www.twitch.tv/teststreamer',
    viewerCount: 1234,
  };

  const embed = createLiveNotificationEmbed(testData);

  await interaction.reply({
    content: '📬 テスト通知を送信します（配信開始の通知デザインプレビュー）',
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });

  logger.info('Test notification sent', {
    serverId: interaction.guildId,
    userId: interaction.user.id,
  });
}
