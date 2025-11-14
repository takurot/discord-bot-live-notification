import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { handlePingCommand } from './commands/ping';

dotenv.config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  logger.error('Missing required environment variables: DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

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
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');

    if (DISCORD_GUILD_ID) {
      // 開発環境: Guildコマンドとして登録（即座に反映）
      await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
        body: commands,
      });
      logger.info(`Successfully reloaded application (/) commands for guild ${DISCORD_GUILD_ID}.`);
    } else {
      // 本番環境: グローバルコマンドとして登録（最大1時間かかる場合あり）
      await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
        body: commands,
      });
      logger.info('Successfully reloaded application (/) commands globally.');
    }
  } catch (error) {
    logger.error('Error registering commands:', error);
  }
}

// Bot起動時の処理
client.once('ready', () => {
  logger.info(`Logged in as ${client.user?.tag}!`);
  registerCommands();
});

// インタラクション（スラッシュコマンド）の処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await handlePingCommand(interaction);
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
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Botをログイン
client.login(DISCORD_BOT_TOKEN).catch((error) => {
  logger.error('Failed to login:', error);
  process.exit(1);
});

