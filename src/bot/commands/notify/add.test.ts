import { ChatInputCommandInteraction } from 'discord.js';
import { handleNotifyAddCommand } from './add';
import { TwitchApiClient } from '../../../services/twitch/TwitchApiClient';
import { ServerRepository } from '../../../models/repositories/ServerRepository';
import { StreamerRepository } from '../../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../../models/repositories/SubscriptionRepository';

// モックの設定
jest.mock('../../../services/twitch/TwitchApiClient');
jest.mock('../../../models/repositories/ServerRepository');
jest.mock('../../../models/repositories/StreamerRepository');
jest.mock('../../../models/repositories/SubscriptionRepository');

describe('handleNotifyAddCommand', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockTwitchApiClient: jest.Mocked<TwitchApiClient>;
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
      getUsers: jest.fn(),
    } as unknown as jest.Mocked<TwitchApiClient>;

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
    mockTwitchApiClient.getUsers.mockResolvedValue([
      {
        id: '123456',
        login: 'ninja',
        display_name: 'Ninja',
      },
    ]);
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
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '✅ Twitch配信者「Ninja」を監視リストに追加しました！',
      ephemeral: true,
    });
    expect(mockStreamerRepository.create).toHaveBeenCalled();
    expect(mockSubscriptionRepository.create).toHaveBeenCalled();
  });

  it('should create server if it does not exist', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
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
    mockTwitchApiClient.getUsers.mockResolvedValue([
      {
        id: '123456',
        login: 'ninja',
        display_name: 'Ninja',
      },
    ]);
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
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockServerRepository.create).toHaveBeenCalledWith('123456789', 'Free');
  });

  it('should reject if free plan limit (3) is reached', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
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
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content:
        '❌ 無料プランでは最大3枠まで登録できます。4枠目以降を追加するには、Proプランへのアップグレードが必要です。',
      ephemeral: true,
    });
    expect(mockStreamerRepository.create).not.toHaveBeenCalled();
    expect(mockSubscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('should reject if streamer does not exist on Twitch', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/invaliduser');
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
    mockTwitchApiClient.getUsers.mockResolvedValue([]); // ユーザーが見つからない

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '❌ Twitchで「invaliduser」という配信者を見つけることができませんでした。URLを確認してください。',
      ephemeral: true,
    });
    expect(mockStreamerRepository.create).not.toHaveBeenCalled();
  });

  it('should reject if already subscribed', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('https://www.twitch.tv/ninja');
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
    mockTwitchApiClient.getUsers.mockResolvedValue([
      {
        id: '123456',
        login: 'ninja',
        display_name: 'Ninja',
      },
    ]);
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
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '❌ 「Ninja」は既に監視リストに登録されています。',
      ephemeral: true,
    });
    expect(mockSubscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('should reject if invalid URL format', async () => {
    (mockInteraction.options.getString as jest.Mock).mockReturnValue('invalid-url');

    await handleNotifyAddCommand(
      mockInteraction,
      mockTwitchApiClient,
      mockServerRepository,
      mockStreamerRepository,
      mockSubscriptionRepository
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: '❌ 無効なTwitch URLです。正しい形式のURLを入力してください。例: https://www.twitch.tv/channelname',
      ephemeral: true,
    });
  });
});

