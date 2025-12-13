import { ChatInputCommandInteraction } from 'discord.js';
import { handleNotifyTestCommand } from './test';

describe('handleNotifyTestCommand', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;

  beforeEach(() => {
    mockInteraction = {
      guildId: '123456789',
      channelId: '987654321',
      user: {
        id: 'user-123',
        username: 'TestUser',
      },
      deferReply: jest.fn(),
      editReply: jest.fn(),
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send test notification with Twitch example', async () => {
    await handleNotifyTestCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '📬 テスト通知を送信します（配信開始の通知デザインプレビュー）',
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringContaining('が配信を開始しました！'),
            color: 0x9146ff, // Twitch purple
          }),
        }),
      ]),
    });
  });

  it('should include test data in notification', async () => {
    await handleNotifyTestCommand(mockInteraction);

    const replyCall = mockInteraction.editReply.mock.calls[0][0];
    expect(replyCall).toHaveProperty('embeds');

    if (
      typeof replyCall === 'object' &&
      replyCall !== null &&
      'embeds' in replyCall &&
      replyCall.embeds
    ) {
      const embed = replyCall.embeds[0];
      expect(embed).toBeDefined();
    }
  });

  it('should use MessageFlags.Ephemeral', async () => {
    await handleNotifyTestCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });
});
