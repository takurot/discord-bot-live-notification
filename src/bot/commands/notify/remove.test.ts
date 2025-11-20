import { ChatInputCommandInteraction } from 'discord.js';
import { handleNotifyRemoveCommand } from './remove';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';

// モックの設定
jest.mock('../../../models/repositories/StreamerRepository');
jest.mock('../../../models/repositories/SubscriptionRepository');
jest.mock('../../../utils/urlParser', () => ({
  detectPlatform: jest.fn(),
  parseTwitchUrl: jest.fn(),
  parseYoutubeUrl: jest.fn(),
}));

import { detectPlatform, parseTwitchUrl, parseYoutubeUrl } from '../../../utils/urlParser';

describe('handleNotifyRemoveCommand', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockStreamerRepository: jest.Mocked<StreamerRepository>;
  let mockSubscriptionRepository: jest.Mocked<SubscriptionRepository>;

  beforeEach(() => {
    // モックの初期化
    mockInteraction = {
      guildId: '123456789',
      channelId: '987654321',
      deferReply: jest.fn(),
      editReply: jest.fn(),
      options: {
        getString: jest.fn(),
      },
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    mockStreamerRepository = {
      findByPlatformAndChannelId: jest.fn(),
    } as unknown as jest.Mocked<StreamerRepository>;

    mockSubscriptionRepository = {
      findByServerAndStreamer: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;

    // モジュールのモックを設定
    (StreamerRepository as jest.MockedClass<typeof StreamerRepository>).mockImplementation(
      () => mockStreamerRepository
    );
    (SubscriptionRepository as jest.MockedClass<typeof SubscriptionRepository>).mockImplementation(
      () => mockSubscriptionRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully remove a subscribed Twitch streamer', async () => {
    // モックの設定
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('ninja');

    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue({
      id: 'streamer-1',
      streamerId: '123456',
      platform: 'Twitch',
      channelId: 'ninja',
      username: 'Ninja',
      lastStatus: 'Offline',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.findByServerAndStreamer.mockResolvedValue({
      id: 'sub-1',
      serverId: '123456789',
      streamerId: '123456',
      notificationChannelId: '987654321',
      customMessage: null,
      mentionRoleId: null,
      embedColor: null,
      embedFooter: null,
      notificationMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.delete.mockResolvedValue({
      id: 'sub-1',
      serverId: '123456789',
      streamerId: '123456',
      notificationChannelId: '987654321',
      customMessage: null,
      mentionRoleId: null,
      embedColor: null,
      embedFooter: null,
      notificationMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await handleNotifyRemoveCommand(
      mockInteraction,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(mockStreamerRepository.findByPlatformAndChannelId).toHaveBeenCalledWith('Twitch', 'ninja');
    expect(mockSubscriptionRepository.findByServerAndStreamer).toHaveBeenCalledWith(
      '123456789',
      '123456'
    );
    expect(mockSubscriptionRepository.delete).toHaveBeenCalledWith('123456789', '123456');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '✅ Twitch配信者「Ninja」を監視リストから削除しました。',
    });
  });

  it('should successfully remove a subscribed YouTube streamer', async () => {
    // モックの設定
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.youtube.com/@YouTube');
    (detectPlatform as jest.Mock).mockReturnValue('YouTube');
    (parseYoutubeUrl as jest.Mock).mockReturnValue('YouTube');

    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue({
      id: 'streamer-2',
      streamerId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
      platform: 'YouTube',
      channelId: 'YouTube',
      username: 'YouTube',
      lastStatus: 'Offline',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.findByServerAndStreamer.mockResolvedValue({
      id: 'sub-2',
      serverId: '123456789',
      streamerId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
      notificationChannelId: '987654321',
      customMessage: null,
      mentionRoleId: null,
      embedColor: null,
      embedFooter: null,
      notificationMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.delete.mockResolvedValue({
      id: 'sub-2',
      serverId: '123456789',
      streamerId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
      notificationChannelId: '987654321',
      customMessage: null,
      mentionRoleId: null,
      embedColor: null,
      embedFooter: null,
      notificationMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await handleNotifyRemoveCommand(
      mockInteraction,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(mockStreamerRepository.findByPlatformAndChannelId).toHaveBeenCalledWith('YouTube', 'YouTube');
    expect(mockSubscriptionRepository.findByServerAndStreamer).toHaveBeenCalledWith(
      '123456789',
      'UC-lHJZR3Gqxm24_Vd_AJ5Yw'
    );
    expect(mockSubscriptionRepository.delete).toHaveBeenCalledWith('123456789', 'UC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '✅ YouTube配信者「YouTube」を監視リストから削除しました。',
    });
  });

  it('should reject if streamer does not exist', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/invaliduser');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('invaliduser');

    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue(null); // Streamer未存在

    await handleNotifyRemoveCommand(
      mockInteraction,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '❌ Twitchで「invaliduser」という配信者を見つけることができませんでした。URLを確認してください。',
    });
    expect(mockSubscriptionRepository.delete).not.toHaveBeenCalled();
  });

  it('should reject if not subscribed', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('ninja');

    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue({
      id: 'streamer-1',
      streamerId: '123456',
      platform: 'Twitch',
      channelId: 'ninja',
      username: 'Ninja',
      lastStatus: 'Offline',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.findByServerAndStreamer.mockResolvedValue(null); // Subscription未存在

    await handleNotifyRemoveCommand(
      mockInteraction,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '❌ 「Ninja」は監視リストに登録されていません。',
    });
    expect(mockSubscriptionRepository.delete).not.toHaveBeenCalled();
  });

  it('should reject if invalid URL format', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('invalid-url');
    (detectPlatform as jest.Mock).mockReturnValue(null);

    await handleNotifyRemoveCommand(
      mockInteraction,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '❌ 対応していないURLです。TwitchまたはYouTubeのチャンネルURLを入力してください。',
    });
    expect(mockSubscriptionRepository.delete).not.toHaveBeenCalled();
  });

  it('should reject if server ID is not available', async () => {
    mockInteraction.guildId = null;
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');

    await handleNotifyRemoveCommand(
      mockInteraction,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: '❌ サーバーIDが見つかりませんでした。このコマンドはサーバーでのみ使用できます。',
    });
    expect(mockSubscriptionRepository.delete).not.toHaveBeenCalled();
  });
});

