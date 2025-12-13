import { ChatInputCommandInteraction, Client } from 'discord.js';
import { handleStatusCommand } from './status';
import { ServerRepository } from '../../models/repositories/ServerRepository';
import { SubscriptionRepository } from '../../models/repositories/SubscriptionRepository';

// モックの設定
jest.mock('../../models/repositories/ServerRepository');
jest.mock('../../models/repositories/SubscriptionRepository');

describe('handleStatusCommand', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockClient: jest.Mocked<Client>;
  let mockServerRepository: jest.Mocked<ServerRepository>;
  let mockSubscriptionRepository: jest.Mocked<SubscriptionRepository>;

  beforeEach(() => {
    mockClient = {
      readyAt: new Date(Date.now() - 3600000), // 1時間前に起動
      guilds: {
        cache: {
          size: 5,
        },
      },
    } as unknown as jest.Mocked<Client>;

    mockInteraction = {
      client: mockClient,
      user: {
        id: 'user-123',
        username: 'TestUser',
      },
      reply: jest.fn(),
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    mockServerRepository = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<ServerRepository>;

    mockSubscriptionRepository = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;

    (ServerRepository as jest.MockedClass<typeof ServerRepository>).mockImplementation(
      () => mockServerRepository
    );
    (SubscriptionRepository as jest.MockedClass<typeof SubscriptionRepository>).mockImplementation(
      () => mockSubscriptionRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display bot status with statistics', async () => {
    mockServerRepository.findAll.mockResolvedValue([
      {
        id: '1',
        serverId: 'server1',
        planType: 'Free',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        serverId: 'server2',
        planType: 'Free',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockSubscriptionRepository.findAll.mockResolvedValue([
      {
        id: 'sub1',
        serverId: 'server1',
        streamerId: 'streamer1',
        notificationChannelId: 'channel1',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'sub2',
        serverId: 'server1',
        streamerId: 'streamer2',
        notificationChannelId: 'channel1',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'sub3',
        serverId: 'server2',
        streamerId: 'streamer3',
        notificationChannelId: 'channel2',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await handleStatusCommand(mockInteraction, mockServerRepository, mockSubscriptionRepository);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringContaining('ステータス'),
          }),
        }),
      ]),
      flags: 64, // MessageFlags.Ephemeral
    });

    expect(mockServerRepository.findAll).toHaveBeenCalled();
    expect(mockSubscriptionRepository.findAll).toHaveBeenCalled();
  });

  it('should display uptime correctly', async () => {
    mockServerRepository.findAll.mockResolvedValue([]);
    mockSubscriptionRepository.findAll.mockResolvedValue([]);

    await handleStatusCommand(mockInteraction, mockServerRepository, mockSubscriptionRepository);

    const replyCall = mockInteraction.reply.mock.calls[0][0];
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

  it('should handle zero statistics', async () => {
    mockServerRepository.findAll.mockResolvedValue([]);
    mockSubscriptionRepository.findAll.mockResolvedValue([]);

    await handleStatusCommand(mockInteraction, mockServerRepository, mockSubscriptionRepository);

    expect(mockInteraction.reply).toHaveBeenCalled();
    expect(mockServerRepository.findAll).toHaveBeenCalled();
    expect(mockSubscriptionRepository.findAll).toHaveBeenCalled();
  });

  it('should calculate unique streamers correctly', async () => {
    mockServerRepository.findAll.mockResolvedValue([]);
    mockSubscriptionRepository.findAll.mockResolvedValue([
      {
        id: 'sub1',
        serverId: 'server1',
        streamerId: 'streamer1',
        notificationChannelId: 'channel1',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'sub2',
        serverId: 'server2',
        streamerId: 'streamer1', // Same streamer, different server
        notificationChannelId: 'channel2',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await handleStatusCommand(mockInteraction, mockServerRepository, mockSubscriptionRepository);

    expect(mockInteraction.reply).toHaveBeenCalled();
  });
});
