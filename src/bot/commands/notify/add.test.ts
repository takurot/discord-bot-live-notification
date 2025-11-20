import { ChatInputCommandInteraction } from 'discord.js';
import { handleNotifyAddCommand } from './add';
import { TwitchApiClient } from '../../../services/twitch/TwitchApiClient';
import { YouTubeApiClient } from '../../../services/youtube/YouTubeApiClient';
import { ServerRepository } from '../../../models/repositories/ServerRepository';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';

// モックの設定
jest.mock('../../../services/twitch/TwitchApiClient');
jest.mock('../../../services/youtube/YouTubeApiClient');
jest.mock('../../../models/repositories/ServerRepository');
jest.mock('../../../models/repositories/StreamerRepository');
jest.mock('../../../models/repositories/SubscriptionRepository');
jest.mock('../../../utils/urlParser', () => ({
  detectPlatform: jest.fn(),
  parseTwitchUrl: jest.fn(),
  parseYoutubeUrl: jest.fn(),
}));

import { detectPlatform, parseTwitchUrl, parseYoutubeUrl } from '../../../utils/urlParser';

describe('handleNotifyAddCommand', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockTwitchApiClient: jest.Mocked<TwitchApiClient>;
  let mockYouTubeApiClient: jest.Mocked<YouTubeApiClient>;
  let mockServerRepository: jest.Mocked<ServerRepository>;
  let mockStreamerRepository: jest.Mocked<StreamerRepository>;
  let mockSubscriptionRepository: jest.Mocked<SubscriptionRepository>;

  beforeEach(() => {
    // モックの初期化
    mockInteraction = {
      guildId: '123456789',
      channelId: '987654321',
      reply: jest.fn(),
      options: {
        getString: jest.fn(),
      },
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    mockTwitchApiClient = {
      getUser: jest.fn(),
    } as unknown as jest.Mocked<TwitchApiClient>;

    mockYouTubeApiClient = {
      getUser: jest.fn(),
    } as unknown as jest.Mocked<YouTubeApiClient>;

    mockServerRepository = {
      findByServerId: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<ServerRepository>;

    mockStreamerRepository = {
      findByPlatformAndChannelId: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<StreamerRepository>;

    mockSubscriptionRepository = {
      findByServerAndStreamer: jest.fn(),
      countByServerId: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;

    // モジュールのモックを設定
    (TwitchApiClient as jest.MockedClass<typeof TwitchApiClient>).mockImplementation(() => mockTwitchApiClient);
    (YouTubeApiClient as jest.MockedClass<typeof YouTubeApiClient>).mockImplementation(() => mockYouTubeApiClient);
    (ServerRepository as jest.MockedClass<typeof ServerRepository>).mockImplementation(() => mockServerRepository);
    (StreamerRepository as jest.MockedClass<typeof StreamerRepository>).mockImplementation(() => mockStreamerRepository);
    (SubscriptionRepository as jest.MockedClass<typeof SubscriptionRepository>).mockImplementation(
      () => mockSubscriptionRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully add a new Twitch streamer', async () => {
    // モックの設定
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('ninja');

    mockServerRepository.findByServerId.mockResolvedValue({
      id: 'server-1',
      serverId: '123456789',
      planType: 'Free',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.countByServerId.mockResolvedValue(2); // 2枠使用中
    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue(null); // Streamer未存在
    mockTwitchApiClient.getUser.mockResolvedValue({
      id: '123456',
      name: 'ninja',
      displayName: 'Ninja',
      url: 'https://www.twitch.tv/ninja',
      thumbnailUrl: 'http://example.com/image.jpg',

    });
    mockStreamerRepository.create.mockResolvedValue({
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
    mockSubscriptionRepository.create.mockResolvedValue({
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

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockYouTubeApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '✅ Twitch配信者「Ninja」を監視リストに追加しました！',
      flags: 64, // MessageFlags.Ephemeral
    });
    expect(mockStreamerRepository.create).toHaveBeenCalled();
    expect(mockSubscriptionRepository.create).toHaveBeenCalled();
  });

  it('should successfully add a new YouTube streamer', async () => {
    // モックの設定
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.youtube.com/@YouTube');
    (detectPlatform as jest.Mock).mockReturnValue('YouTube');
    (parseYoutubeUrl as jest.Mock).mockReturnValue('YouTube');

    mockServerRepository.findByServerId.mockResolvedValue({
      id: 'server-1',
      serverId: '123456789',
      planType: 'Free',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.countByServerId.mockResolvedValue(2);
    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue(null);
    mockYouTubeApiClient.getUser.mockResolvedValue({
      id: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
      name: 'YouTube',
      displayName: 'YouTube',
      url: 'https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw',
      thumbnailUrl: 'http://example.com/image.jpg',

    });
    mockStreamerRepository.create.mockResolvedValue({
      id: 'streamer-2',
      streamerId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
      platform: 'YouTube',
      channelId: 'YouTube',
      username: 'YouTube',
      lastStatus: 'Offline',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.findByServerAndStreamer.mockResolvedValue(null);
    mockSubscriptionRepository.create.mockResolvedValue({
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

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockYouTubeApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '✅ YouTube配信者「YouTube」を監視リストに追加しました！',
      flags: 64, // MessageFlags.Ephemeral
    });
    expect(mockStreamerRepository.create).toHaveBeenCalled();
    expect(mockSubscriptionRepository.create).toHaveBeenCalled();
  });

  it('should create server if it does not exist', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('ninja');

    mockServerRepository.findByServerId.mockResolvedValue(null); // サーバー未存在
    mockServerRepository.create.mockResolvedValue({
      id: 'server-1',
      serverId: '123456789',
      planType: 'Free',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.countByServerId.mockResolvedValue(0);
    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue(null);
    mockTwitchApiClient.getUser.mockResolvedValue({
      id: '123456',
      name: 'ninja',
      displayName: 'Ninja',
      url: 'https://www.twitch.tv/ninja',
      thumbnailUrl: 'http://example.com/image.jpg',

    });
    mockStreamerRepository.create.mockResolvedValue({
      id: 'streamer-1',
      streamerId: '123456',
      platform: 'Twitch',
      channelId: 'ninja',
      username: 'Ninja',
      lastStatus: 'Offline',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.findByServerAndStreamer.mockResolvedValue(null);
    mockSubscriptionRepository.create.mockResolvedValue({
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

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockYouTubeApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockServerRepository.create).toHaveBeenCalledWith('123456789', 'Free');
  });

  it('should reject if free plan limit (3) is reached', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('ninja');

    mockServerRepository.findByServerId.mockResolvedValue({
      id: 'server-1',
      serverId: '123456789',
      planType: 'Free',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.countByServerId.mockResolvedValue(3); // 上限到達

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockYouTubeApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content:
        '❌ 無料プランでは最大3枠まで登録できます。4枠目以降を追加するには、Proプランへのアップグレードが必要です。',
      flags: 64, // MessageFlags.Ephemeral
    });
    expect(mockStreamerRepository.create).not.toHaveBeenCalled();
    expect(mockSubscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('should reject if streamer does not exist on Twitch', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/invaliduser');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('invaliduser');

    mockServerRepository.findByServerId.mockResolvedValue({
      id: 'server-1',
      serverId: '123456789',
      planType: 'Free',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.countByServerId.mockResolvedValue(2);
    mockStreamerRepository.findByPlatformAndChannelId.mockResolvedValue(null);
    mockTwitchApiClient.getUser.mockResolvedValue(null); // ユーザーが見つからない

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockYouTubeApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '❌ Twitchで「invaliduser」という配信者を見つけることができませんでした。URLを確認してください。',
      flags: 64, // MessageFlags.Ephemeral
    });
    expect(mockStreamerRepository.create).not.toHaveBeenCalled();
  });

  it('should reject if already subscribed', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
    (detectPlatform as jest.Mock).mockReturnValue('Twitch');
    (parseTwitchUrl as jest.Mock).mockReturnValue('ninja');

    mockServerRepository.findByServerId.mockResolvedValue({
      id: 'server-1',
      serverId: '123456789',
      planType: 'Free',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSubscriptionRepository.countByServerId.mockResolvedValue(2);
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
    mockTwitchApiClient.getUser.mockResolvedValue({
      id: '123456',
      name: 'ninja',
      displayName: 'Ninja',
      url: 'https://www.twitch.tv/ninja',
      thumbnailUrl: 'http://example.com/image.jpg',

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
    }); // 既に登録済み

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockYouTubeApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '❌ 「Ninja」は既に監視リストに登録されています。',
      flags: 64, // MessageFlags.Ephemeral
    });
    expect(mockSubscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('should reject if invalid URL format', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('invalid-url');
    (detectPlatform as jest.Mock).mockReturnValue(null);

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockYouTubeApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '❌ 対応していないURLです。TwitchまたはYouTubeのチャンネルURLを入力してください。',
      flags: 64, // MessageFlags.Ephemeral
    });
  });
});

