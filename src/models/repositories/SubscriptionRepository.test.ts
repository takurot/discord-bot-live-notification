import { PrismaClient } from '@prisma/client';
import { SubscriptionRepository } from './SubscriptionRepository';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    subscription: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

describe('SubscriptionRepository', () => {
  let repository: SubscriptionRepository;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    repository = new SubscriptionRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('findByServerId', () => {
    it('should return subscriptions for a server', async () => {
      const mockSubscriptions = [
        {
          id: '1',
          serverId: '123456789012345678',
          streamerId: 'twitch_123456',
          notificationChannelId: '987654321098765432',
          customMessage: null,
          mentionRoleId: null,
          embedColor: null,
          embedFooter: null,
          notificationMessageId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubscriptions);

      const result = await repository.findByServerId('123456789012345678');

      expect(result).toEqual(mockSubscriptions);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { serverId: '123456789012345678' },
        include: {
          streamer: true,
        },
      });
    });
  });

  describe('create', () => {
    it('should create a new subscription', async () => {
      const mockSubscription = {
        id: '1',
        serverId: '123456789012345678',
        streamerId: 'twitch_123456',
        notificationChannelId: '987654321098765432',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.subscription.create as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await repository.create({
        serverId: '123456789012345678',
        streamerId: 'twitch_123456',
        notificationChannelId: '987654321098765432',
      });

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: {
          serverId: '123456789012345678',
          streamerId: 'twitch_123456',
          notificationChannelId: '987654321098765432',
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete a subscription', async () => {
      const mockSubscription = {
        id: '1',
        serverId: '123456789012345678',
        streamerId: 'twitch_123456',
        notificationChannelId: '987654321098765432',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.subscription.delete as jest.Mock).mockResolvedValue(mockSubscription);

      await repository.delete('123456789012345678', 'twitch_123456');

      expect(mockPrisma.subscription.delete).toHaveBeenCalledWith({
        where: {
          serverId_streamerId: {
            serverId: '123456789012345678',
            streamerId: 'twitch_123456',
          },
        },
      });
    });
  });

  describe('countByServerId', () => {
    it('should return count of subscriptions for a server', async () => {
      (mockPrisma.subscription.findMany as jest.Mock).mockResolvedValue([
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ]);

      const count = await repository.countByServerId('123456789012345678');

      expect(count).toBe(3);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { serverId: '123456789012345678' },
        select: { id: true },
      });
    });
  });

  describe('findByServerAndStreamer', () => {
    it('should return subscription when found', async () => {
      const mockSubscription = {
        id: '1',
        serverId: '123456789012345678',
        streamerId: 'twitch_123456',
        notificationChannelId: '987654321098765432',
        customMessage: null,
        mentionRoleId: null,
        embedColor: null,
        embedFooter: null,
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await repository.findByServerAndStreamer(
        '123456789012345678',
        'twitch_123456'
      );

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: {
          serverId_streamerId: {
            serverId: '123456789012345678',
            streamerId: 'twitch_123456',
          },
        },
      });
    });

    it('should return null when not found', async () => {
      (mockPrisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByServerAndStreamer(
        '123456789012345678',
        'twitch_123456'
      );

      expect(result).toBeNull();
    });
  });
});
