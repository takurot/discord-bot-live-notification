import { Client, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { handlePingCommand } from './commands/ping';
import { handleStatusCommand } from './commands/status';
import { handleNotifyAddCommand } from './commands/notify/add';
import { handleNotifyRemoveCommand } from './commands/notify/remove';
import { handleNotifyListCommand } from './commands/notify/list';
import { handleNotifyTestCommand } from './commands/notify/test';
import { TwitchApiClient } from '../services/twitch/TwitchApiClient';
import { TwitchPollingService } from '../services/polling/TwitchPollingService';
import {
  ServerRepository,
  StreamerRepository,
  SubscriptionRepository,
} from '../models/repositories';
import { prisma } from '../models/prisma';

dotenv.config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  logger.error('Missing required environment variables: DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

// 型安全性のための確認（上記のチェック後は必ず存在する）
const botToken: string = DISCORD_BOT_TOKEN;
const clientId: string = DISCORD_CLIENT_ID;

// Twitch API クライアントの初期化
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
  logger.warn('Missing Twitch API credentials. /notify add command will not work.');
}

const twitchApiClient =
  TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET
    ? new TwitchApiClient(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)
    : null;

// Repository インスタンスの作成
const serverRepository = new ServerRepository(prisma);
const streamerRepository = new StreamerRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);

// イベントエミッターの作成
const eventEmitter = new EventEmitter();

// ポーリングサービスの作成
let pollingService: TwitchPollingService | null = null;
if (twitchApiClient) {
  pollingService = new TwitchPollingService(
    twitchApiClient,
    subscriptionRepository,
    streamerRepository,
    eventEmitter
  );
}

// ポーリング間隔（デフォルト: 5分）
const POLLING_INTERVAL_MS = parseInt(process.env.POLLING_INTERVAL_MS || '300000', 10);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// スラッシュコマンドを登録
async function registerCommands() {
  const commands = [
    {
      name: 'ping',
      description: 'Botの応答速度を確認します',
    },
    {
      name: 'status',
      description: 'Botの稼働状況と統計情報を表示します',
    },
    {
      name: 'notify',
      description: '配信通知の管理',
      options: [
        {
          name: 'add',
          type: 1, // SUB_COMMAND
          description: '配信者を監視リストに追加します',
          options: [
            {
              name: 'url',
              type: 3, // STRING
              description: 'TwitchチャンネルのURL（例: https://www.twitch.tv/channelname）',
              required: true,
            },
          ],
        },
        {
          name: 'remove',
          type: 1, // SUB_COMMAND
          description: '監視リストから配信者を削除します',
          options: [
            {
              name: 'url',
              type: 3, // STRING
              description: 'TwitchチャンネルのURL（例: https://www.twitch.tv/channelname）',
              required: true,
            },
          ],
        },
        {
          name: 'list',
          type: 1, // SUB_COMMAND
          description: '監視中の配信者一覧を表示します',
        },
        {
          name: 'test',
          type: 1, // SUB_COMMAND
          description: '通知のテスト送信（デザイン確認用）',
        },
      ],
    },
  ];

  const rest = new REST({ version: '10' }).setToken(botToken);

  try {
    logger.info('Started refreshing application (/) commands.');

    if (DISCORD_GUILD_ID) {
      // 開発環境: Guildコマンドとして登録（即座に反映）
      await rest.put(Routes.applicationGuildCommands(clientId, DISCORD_GUILD_ID), {
        body: commands,
      });
      logger.info(`Successfully reloaded application (/) commands for guild ${DISCORD_GUILD_ID}.`);
    } else {
      // 本番環境: グローバルコマンドとして登録（最大1時間かかる場合あり）
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      logger.info('Successfully reloaded application (/) commands globally.');
    }
  } catch (error) {
    logger.error('Error registering commands:', error);
  }
}

// Bot起動時の処理
client.once('clientReady', () => {
  logger.info(`Logged in as ${client.user?.tag}!`);
  registerCommands();

  // ポーリングサービスを開始
  if (pollingService) {
    logger.info(`Starting polling service with interval: ${POLLING_INTERVAL_MS}ms`);
    pollingService.start(POLLING_INTERVAL_MS);
  } else {
    logger.warn('Polling service not initialized (missing Twitch API credentials)');
  }
});

// インタラクション（スラッシュコマンド）の処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await handlePingCommand(interaction);
  } else if (interaction.commandName === 'status') {
    await handleStatusCommand(interaction, serverRepository, subscriptionRepository);
  } else if (interaction.commandName === 'notify') {
    const subcommand = interaction.options.getSubcommand(false);

    if (subcommand === 'add') {
      if (!twitchApiClient) {
        await interaction.reply({
          content: '❌ Twitch APIの認証情報が設定されていません。Bot管理者にお問い合わせください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await handleNotifyAddCommand(
        interaction,
        twitchApiClient,
        serverRepository,
        streamerRepository,
        subscriptionRepository
      );
    } else if (subcommand === 'remove') {
      await handleNotifyRemoveCommand(interaction, streamerRepository, subscriptionRepository);
    } else if (subcommand === 'list') {
      await handleNotifyListCommand(interaction, subscriptionRepository);
    } else if (subcommand === 'test') {
      await handleNotifyTestCommand(interaction);
    }
  }
});

// エラーハンドリング
client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

client.on('warn', (warning) => {
  logger.warn('Discord client warning:', warning);
});

// プロセス終了時の処理
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (pollingService) {
    pollingService.stop();
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  if (pollingService) {
    pollingService.stop();
  }
  client.destroy();
  process.exit(0);
});

// Botをログイン
client.login(botToken).catch((error) => {
  logger.error('Failed to login:', error);
  process.exit(1);
});
