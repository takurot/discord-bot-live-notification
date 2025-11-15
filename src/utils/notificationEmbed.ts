import { EmbedBuilder } from 'discord.js';

export interface LiveNotificationData {
  platform: 'Twitch' | 'YouTube';
  username: string;
  streamTitle: string;
  game: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  viewerCount: number | null;
}

/**
 * 配信開始通知のEmbedを生成する
 */
export function createLiveNotificationEmbed(data: LiveNotificationData): EmbedBuilder {
  const { platform, username, streamTitle, game, thumbnailUrl, streamUrl, viewerCount } = data;

  // プラットフォームに応じた色
  const color = platform === 'Twitch' ? 0x9146ff : 0xff0000;

  const embed = new EmbedBuilder()
    .setTitle(`🔴 ${username} が配信を開始しました！`)
    .setDescription(streamTitle)
    .setColor(color)
    .setURL(streamUrl)
    .setTimestamp();

  // サムネイル画像
  if (thumbnailUrl) {
    embed.setThumbnail(thumbnailUrl);
  }

  // カテゴリ（ゲーム）
  if (game) {
    embed.addFields({
      name: 'カテゴリ',
      value: game,
      inline: true,
    });
  }

  // 視聴者数
  if (viewerCount !== null) {
    embed.addFields({
      name: '視聴者数',
      value: `${viewerCount.toLocaleString('ja-JP')}人`,
      inline: true,
    });
  }

  return embed;
}
