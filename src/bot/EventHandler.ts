import { ChatInputCommandInteraction, Client, Interaction, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger';
import { TwitchApiClient } from '../services/twitch/TwitchApiClient';
import { YouTubeApiClient } from '../services/youtube/YouTubeApiClient';
import { PubSubHubbubService } from '../services/youtube/PubSubHubbubService';
import {
    ServerRepository,
    StreamerRepository,
    SubscriptionRepository,
} from '../models/repositories';
import { handlePingCommand } from './commands/ping';
import { handleStatusCommand } from './commands/status';
import { handleNotifyAddCommand } from './commands/notify/add';
import { handleNotifyRemoveCommand } from './commands/notify/remove';
import { handleNotifyListCommand } from './commands/notify/list';
import { handleNotifyTestCommand } from './commands/notify/test';
import { handleYoutubeCheckCommand } from './commands/debug/youtubeCheck';

export interface BotServices {
    twitchApiClient: TwitchApiClient | null;
    youtubeApiClient: YouTubeApiClient | null;
    serverRepository: ServerRepository;
    streamerRepository: StreamerRepository;
    subscriptionRepository: SubscriptionRepository;
    pubSubHubbubService: PubSubHubbubService | null;
}

export class EventHandler {
    private client: Client;
    private services: BotServices;

    constructor(client: Client, services: BotServices) {
        this.client = client;
        this.services = services;
    }

    setup() {
        this.client.on('interactionCreate', this.handleInteraction.bind(this));
        this.client.on('error', this.handleError.bind(this));
        this.client.on('warn', this.handleWarn.bind(this));
    }

    private async handleInteraction(interaction: Interaction) {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;
        const {
            youtubeApiClient,
            serverRepository,
            subscriptionRepository,
        } = this.services;

        try {
            if (commandName === 'ping') {
                await handlePingCommand(interaction);
            } else if (commandName === 'status') {
                await handleStatusCommand(interaction, serverRepository, subscriptionRepository);
            } else if (commandName === 'notify') {
                await this.handleNotifyCommand(interaction);
            } else if (commandName === 'test-youtube') {
                if (!youtubeApiClient) {
                    await interaction.reply({
                        content: '❌ YouTube API Keyが設定されていません。',
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                await handleYoutubeCheckCommand(interaction, youtubeApiClient);
            }
        } catch (error) {
            logger.error(`Error handling command ${commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'コマンド実行中にエラーが発生しました。',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: 'コマンド実行中にエラーが発生しました。',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    }

    private async handleNotifyCommand(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand(false);
        const {
            twitchApiClient,
            youtubeApiClient,
            pubSubHubbubService,
            serverRepository,
            streamerRepository,
            subscriptionRepository,
        } = this.services;

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
                youtubeApiClient,
                pubSubHubbubService,
                serverRepository,
                streamerRepository,
                subscriptionRepository
            );
        } else if (subcommand === 'remove') {
            await handleNotifyRemoveCommand(
                interaction,
                streamerRepository,
                subscriptionRepository,
                pubSubHubbubService,
                youtubeApiClient
            );
        } else if (subcommand === 'list') {
            await handleNotifyListCommand(interaction, subscriptionRepository);
        } else if (subcommand === 'test') {
            await handleNotifyTestCommand(interaction);
        }
    }

    private handleError(error: Error) {
        logger.error('Discord client error:', error);
    }

    private handleWarn(warning: string) {
        logger.warn('Discord client warning:', warning);
    }
}
