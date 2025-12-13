import { REST, Routes } from 'discord.js';
import { logger } from '../utils/logger';

export class CommandRegister {
  private token: string;
  private clientId: string;

  constructor(token: string, clientId: string) {
    this.token = token;
    this.clientId = clientId;
  }

  private getCommands() {
    return [
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
                description: 'Twitch/YouTubeチャンネルのURL',
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
                description: 'Twitch/YouTubeチャンネルのURL',
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
      {
        name: 'status',
        description: 'ボットのステータスを表示します',
      },
      {
        name: 'test-youtube',
        description: '[DEBUG] YouTube APIの動作確認',
        options: [
          {
            name: 'url',
            type: 3, // STRING
            description: 'YouTubeチャンネルのURLまたはハンドル',
            required: true,
          },
        ],
      },
    ];
  }

  async registerCommands() {
    const rest = new REST({ version: '10' }).setToken(this.token);
    const commands = this.getCommands();

    try {
      logger.info('Started refreshing application (/) commands.');

      await rest.put(Routes.applicationCommands(this.clientId), {
        body: commands,
      });

      logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
      logger.error('Failed to reload application (/) commands', error as Error);
      throw error;
    }
  }
}
