import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { parseTwitchUrl } from '../../../utils/twitchUrlParser';
import { TwitchApiClient } from '../../../services/twitch/TwitchApiClient';
import { ServerRepository } from '../../../models/repositories/ServerRepository';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';

const FREE_PLAN_LIMIT = 3;

export async function handleNotifyAddCommand(
  interaction: ChatInputCommandInteraction,
  twitchApiClient: TwitchApiClient,
  serverRepository: ServerRepository,
  streamerRepository: StreamerRepository,
  subscriptionRepository: SubscriptionRepository
): Promise<void> {
  const url = interaction.options.getString('url', true);

  // URLパース
  let channelName: string;
  try {
    channelName = parseTwitchUrl(url);
  } catch (error) {
    await interaction.reply({
      content:
        '❌ 無効なTwitch URLです。正しい形式のURLを入力してください。例: https://www.twitch.tv/channelname',
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

  // Twitch APIでユーザー情報取得
  const users = await twitchApiClient.getUsers([channelName]);
  if (users.length === 0) {
    await interaction.reply({
      content: `❌ Twitchで「${channelName}」という配信者を見つけることができませんでした。URLを確認してください。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const twitchUser = users[0];
  const streamerId = twitchUser.id;

  // Streamerの存在確認・作成
  let streamer = await streamerRepository.findByPlatformAndChannelId('Twitch', channelName);
  if (!streamer) {
    streamer = await streamerRepository.create({
      streamerId,
      platform: 'Twitch',
      channelId: channelName,
      username: twitchUser.display_name,
    });
  }

  // Subscriptionの存在確認
  const existingSubscription = await subscriptionRepository.findByServerAndStreamer(
    serverId,
    streamerId
  );
  if (existingSubscription) {
    await interaction.reply({
      content: `❌ 「${twitchUser.display_name}」は既に監視リストに登録されています。`,
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
    content: `✅ Twitch配信者「${twitchUser.display_name}」を監視リストに追加しました！`,
    flags: MessageFlags.Ephemeral,
  });
}
