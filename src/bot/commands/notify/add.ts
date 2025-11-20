import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { detectPlatform, parseTwitchUrl, parseYoutubeUrl } from '../../../utils/urlParser';
import { TwitchApiClient } from '../../../services/twitch/TwitchApiClient';
import { YouTubeApiClient } from '../../../services/youtube/YouTubeApiClient';
import { ServerRepository } from '../../../models/repositories/ServerRepository';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';
import { StreamProvider } from '../../../services/common/StreamProvider';

const FREE_PLAN_LIMIT = 3;

export async function handleNotifyAddCommand(
  interaction: ChatInputCommandInteraction,
  twitchApiClient: TwitchApiClient | null,
  youtubeApiClient: YouTubeApiClient | null,
  serverRepository: ServerRepository,
  streamerRepository: StreamerRepository,
  subscriptionRepository: SubscriptionRepository
): Promise<void> {
  const url = interaction.options.getString('url', true);

  // プラットフォーム判定
  const platform = detectPlatform(url);
  if (!platform) {
    await interaction.reply({
      content: '❌ 対応していないURLです。TwitchまたはYouTubeのチャンネルURLを入力してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // チャンネルID/ハンドル抽出
  let channelIdentifier: string | null = null;
  let provider: StreamProvider | null = null;

  if (platform === 'Twitch') {
    if (!twitchApiClient) {
      await interaction.reply({
        content: '❌ Twitch連携が有効になっていません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    channelIdentifier = parseTwitchUrl(url);
    provider = twitchApiClient;
  } else if (platform === 'YouTube') {
    if (!youtubeApiClient) {
      await interaction.reply({
        content: '❌ YouTube連携が有効になっていません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    channelIdentifier = parseYoutubeUrl(url);
    provider = youtubeApiClient;
  }

  if (!channelIdentifier) {
    await interaction.reply({
      content: `❌ 無効な${platform} URLです。正しい形式のURLを入力してください。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // サーバーIDとチャンネルIDの取得
  const serverId = interaction.guildId;
  const channelId = interaction.channelId;

  if (!serverId || !channelId) {
    await interaction.reply({
      content: '❌ サーバーまたはチャンネル情報を取得できませんでした。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // サーバーの存在確認・作成
  let server = await serverRepository.findByServerId(serverId);
  if (!server) {
    server = await serverRepository.create(serverId, 'Free');
  }

  // 無料プラン上限チェック
  if (server.planType === 'Free') {
    const subscriptionCount = await subscriptionRepository.countByServerId(serverId);
    if (subscriptionCount >= FREE_PLAN_LIMIT) {
      await interaction.reply({
        content:
          '❌ 無料プランでは最大3枠まで登録できます。4枠目以降を追加するには、Proプランへのアップグレードが必要です。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // APIでユーザー情報取得
  const user = await provider!.getUser(channelIdentifier);
  if (!user) {
    await interaction.reply({
      content: `❌ ${platform}で「${channelIdentifier}」という配信者を見つけることができませんでした。URLを確認してください。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const streamerId = user.id;

  // Streamerの存在確認・作成
  let streamer = await streamerRepository.findByPlatformAndChannelId(platform, channelIdentifier);
  // Note: For YouTube, channelIdentifier might be a handle, but we want to store the Channel ID if possible?
  // Actually, user.id from getUser is the Channel ID (for YouTube) or User ID (for Twitch).
  // But streamerRepository stores `channelId` which is used for display/lookup?
  // In Twitch implementation, `channelId` was `channelName` (username).
  // In YouTube, it should probably be the Channel ID or Handle?
  // Let's stick to what `getUser` returns.
  // Twitch: id=numeric, name=login.
  // YouTube: id=UC..., name=handle/title.

  // We should probably store the unique ID in `streamerId` (DB column `streamer_id`) and the display identifier in `channelId` (DB column `channel_id` - wait, naming is confusing).
  // DB Schema:
  // streamer_id: String (Unique ID from platform)
  // channel_id: String (User-friendly ID, e.g. username or handle)

  // For Twitch: streamer_id = "12345", channel_id = "ninja"
  // For YouTube: streamer_id = "UC...", channel_id = "@handle" or "UC..."

  // Let's check what we did for Twitch before:
  // streamerId = twitchUser.id
  // channelId = channelName (from URL parser, which is username)

  // For YouTube, `channelIdentifier` from parser might be handle or ID.
  // `user.name` from `YouTubeApiClient.getUser` is handle or title.
  // Let's use `user.name` for `channelId` (display purpose) and `user.id` for `streamerId`.

  if (!streamer) {
    // Check if streamer exists by ID (in case name changed or different URL format used)
    // streamerRepository doesn't have findByStreamerIdAndPlatform?
    // It has findByPlatformAndChannelId.
    // We might need to check by streamer_id too if we want to be robust, but for now let's trust the flow.

    streamer = await streamerRepository.create({
      streamerId: user.id,
      platform: platform,
      channelId: user.name, // Store handle/username
      username: user.displayName,
    });
  }

  // Subscriptionの存在確認
  const existingSubscription = await subscriptionRepository.findByServerAndStreamer(
    serverId,
    streamerId
  );
  if (existingSubscription) {
    await interaction.reply({
      content: `❌ 「${user.displayName}」は既に監視リストに登録されています。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Subscription作成
  await subscriptionRepository.create({
    serverId,
    streamerId,
    notificationChannelId: channelId,
  });

  await interaction.reply({
    content: `✅ ${platform}配信者「${user.displayName}」を監視リストに追加しました！`,
    flags: MessageFlags.Ephemeral,
  });
}
