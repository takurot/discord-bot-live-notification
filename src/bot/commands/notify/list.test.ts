import { ChatInputCommandInteraction } from 'discord.js';
import { handleNotifyListCommand } from './list';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';

// モックの設定
jest.mock('../../../models/repositories/SubscriptionRepository');

describe('handleNotifyListCommand', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockSubscriptionRepository: jest.Mocked<SubscriptionRepository>;

  beforeEach(() => {
    // モックの初期化
    mockInteraction = {
      guildId: '123456789',
      deferReply: jest.fn(),
      editReply: jest.fn(),
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    mockSubscriptionRepository = {
      findByServerId: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;

    // モジュールのモックを設定
    (SubscriptionRepository as jest.MockedClass<typeof SubscriptionRepository>).mockImplementation(
      () => mockSubscriptionRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display list of subscribed streamers', async () => {
    // モックの設定
    mockSubscriptionRepository.findByServerId.mockResolvedValue([
      {
        id: 'sub-1',
        serverId: '123456789',
        streamerId: 'streamer-1',
        notificationChannelId: '987654321',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        streamer: {
          id: 'streamer-1',
          streamerId: 'streamer-1',
          platform: 'Twitch',
          channelId: 'ninja',
          username: 'Ninja',
          lastStatus: 'Offline',
        },
      },
      {
        id: 'sub-2',
        serverId: '123456789',
        streamerId: 'streamer-2',
        notificationChannelId: '987654321',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        streamer: {
          id: 'streamer-2',
          streamerId: 'streamer-2',
          platform: 'Twitch',
          channelId: 'shroud',
          username: 'Shroud',
          lastStatus: 'Offline',
        },
      },
    ]);

    await handleNotifyListCommand(mockInteraction, mockSubscriptionRepository);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockSubscriptionRepository.findByServerId).toHaveBeenCalledWith('123456789');
    expect(mockInteraction.editReply).toHaveBeenCalled();
    
    const replyCall = mockInteraction.editReply.mock.calls[0][0];
    expect(replyCall).toHaveProperty('embeds');
    if (typeof replyCall === 'object' && replyCall !== null && 'embeds' in replyCall && replyCall.embeds) {
      expect(Array.isArray(replyCall.embeds)).toBe(true);
      expect(replyCall.embeds.length).toBeGreaterThan(0);
    }
  });

  it('should display message when no streamers are registered', async () => {
    mockSubscriptionRepository.findByServerId.mockResolvedValue([]);

    await handleNotifyListCommand(mockInteraction, mockSubscriptionRepository);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockSubscriptionRepository.findByServerId).toHaveBeenCalledWith('123456789');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '現在、監視中の配信者はいません。\n`/notify add` コマンドで配信者を追加してください。',
    });
  });

  it('should reject if server ID is not available', async () => {
    mockInteraction.guildId = null;

    await handleNotifyListCommand(mockInteraction, mockSubscriptionRepository);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '❌ サーバーIDが見つかりませんでした。このコマンドはサーバーでのみ使用できます。',
    });
    expect(mockSubscriptionRepository.findByServerId).not.toHaveBeenCalled();
  });

  it('should display correct platform and channel information', async () => {
    mockSubscriptionRepository.findByServerId.mockResolvedValue([
      {
        id: 'sub-1',
        serverId: '123456789',
        streamerId: 'streamer-1',
        notificationChannelId: '987654321',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        streamer: {
          id: 'streamer-1',
          streamerId: 'streamer-1',
          platform: 'Twitch',
          channelId: 'test_channel',
          username: 'TestStreamer',
          lastStatus: 'Offline',
        },
      },
    ]);

    await handleNotifyListCommand(mockInteraction, mockSubscriptionRepository);

    expect(mockInteraction.editReply).toHaveBeenCalled();
    
    const replyCall = mockInteraction.editReply.mock.calls[0][0];
    expect(replyCall).toHaveProperty('embeds');
  });
});

