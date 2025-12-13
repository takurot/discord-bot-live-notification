import { Client, GatewayIntentBits } from 'discord.js';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { registerGlobalErrorHandlers } from '../utils/globalErrorHandler';
import { TwitchApiClient } from '../services/twitch/TwitchApiClient';
import { YouTubeApiClient } from '../services/youtube/YouTubeApiClient';
import { TwitchPollingService } from '../services/polling/TwitchPollingService';
import { YouTubePollingService } from '../services/polling/YouTubePollingService';
import { NotificationService } from '../services/notification/NotificationService';
import { PubSubHubbubService } from '../services/youtube/PubSubHubbubService';
import { WebhookServer } from '../api/WebhookServer';
import {
  ServerRepository,
  StreamerRepository,
  SubscriptionRepository,
} from '../models/repositories';
import { prisma } from '../models/prisma';
import { CommandRegister } from './CommandRegister';
import { EventHandler } from './EventHandler';

dotenv.config();

const globalErrorHandlers = registerGlobalErrorHandlers();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  logger.error('Missing required environment variables: DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

// 型安全性のための確認
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

// YouTube API クライアントの初期化
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  logger.warn('Missing YouTube API Key. YouTube functionality will not work.');
}

const youtubeApiClient = YOUTUBE_API_KEY ? new YouTubeApiClient(YOUTUBE_API_KEY) : null;

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

let youtubePollingService: YouTubePollingService | null = null;
if (youtubeApiClient) {
  youtubePollingService = new YouTubePollingService(
    youtubeApiClient,
    subscriptionRepository,
    streamerRepository,
    eventEmitter
  );
}

// PubSubHubbub Service & Webhook Server
const CALLBACK_URL = process.env.CALLBACK_URL;
const PORT = parseInt(process.env.PORT || '3000', 10);

let pubSubHubbubService: PubSubHubbubService | null = null;
let webhookServer: WebhookServer | null = null;

if (youtubeApiClient && CALLBACK_URL) {
  pubSubHubbubService = new PubSubHubbubService(
    youtubeApiClient,
    streamerRepository,
    subscriptionRepository,

    eventEmitter,
    CALLBACK_URL
  );

  webhookServer = new WebhookServer(pubSubHubbubService, PORT);
} else if (!CALLBACK_URL) {
  logger.warn('CALLBACK_URL not set. PubSubHubbub service will not be initialized.');
}

// ポーリング間隔（デフォルト: 5分）
const POLLING_INTERVAL_MS = parseInt(process.env.POLLING_INTERVAL_MS || '300000', 10);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 通知サービスの作成
new NotificationService(client, subscriptionRepository, eventEmitter);

// コマンド登録クラスの初期化
const commandRegister = new CommandRegister(botToken, clientId);

// イベントハンドラーの初期化
const eventHandler = new EventHandler(client, {
  twitchApiClient,
  youtubeApiClient,
  pubSubHubbubService,
  serverRepository,
  streamerRepository,
  subscriptionRepository,
});
eventHandler.setup();

// Bot起動時の処理
client.once('clientReady', async () => {
  logger.info(`Logged in as ${client.user?.tag}!`);

  // コマンド登録
  await commandRegister.registerCommands();

  // Webhookサーバーを開始
  if (webhookServer) {
    webhookServer.start();
  }

  // ポーリングサービスを開始
  if (pollingService) {
    logger.info(`Starting Twitch polling service with interval: ${POLLING_INTERVAL_MS}ms`);
    pollingService.start(POLLING_INTERVAL_MS);
  } else {
    logger.warn('Twitch polling service not initialized (missing Twitch API credentials)');
  }

  if (youtubePollingService) {
    logger.info(`Starting YouTube polling service with interval: ${POLLING_INTERVAL_MS}ms`);
    youtubePollingService.start(POLLING_INTERVAL_MS);
  } else {
    logger.warn('YouTube polling service not initialized (missing YouTube API key)');
  }
});

// プロセス終了時の処理
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (pollingService) {
    pollingService.stop();
  }
  if (youtubePollingService) {
    youtubePollingService.stop();
  }
  globalErrorHandlers.dispose();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  if (pollingService) {
    pollingService.stop();
  }
  if (youtubePollingService) {
    youtubePollingService.stop();
  }
  globalErrorHandlers.dispose();
  client.destroy();
  process.exit(0);
});

// Botをログイン
client.login(botToken).catch((error) => {
  logger.error('Failed to login:', error);
  process.exit(1);
});
