import { PrismaClient } from '@prisma/client';
import { StreamerRepository } from './StreamerRepository';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    streamer: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

describe('StreamerRepository', () => {
  let repository: StreamerRepository;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    repository = new StreamerRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('findByStreamerId', () => {
    it('should return streamer when found', async () => {
      const mockStreamer = {
        id: '1',
        streamerId: 'twitch_123456',
        platform: 'Twitch',
        channelId: '123456',
        username: 'test_user',
        lastStatus: 'Offline',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.streamer.findUnique as jest.Mock).mockResolvedValue(mockStreamer);

      const result = await repository.findByStreamerId('twitch_123456');

      expect(result).toEqual(mockStreamer);
      expect(mockPrisma.streamer.findUnique).toHaveBeenCalledWith({
        where: { streamerId: 'twitch_123456' },
      });
    });
  });

  describe('create', () => {
    it('should create a new streamer', async () => {
      const mockStreamer = {
        id: '1',
        streamerId: 'twitch_123456',
        platform: 'Twitch' as const,
        channelId: '123456',
        username: 'test_user',
        lastStatus: 'Offline',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.streamer.create as jest.Mock).mockResolvedValue(mockStreamer);

      const result = await repository.create({
        streamerId: 'twitch_123456',
        platform: 'Twitch',
        channelId: '123456',
        username: 'test_user',
      });

      expect(result).toEqual(mockStreamer);
      expect(mockPrisma.streamer.create).toHaveBeenCalledWith({
        data: {
          streamerId: 'twitch_123456',
          platform: 'Twitch',
          channelId: '123456',
          username: 'test_user',
          lastStatus: 'Offline',
        },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update streamer status', async () => {
      const mockStreamer = {
        id: '1',
        streamerId: 'twitch_123456',
        platform: 'Twitch',
        channelId: '123456',
        username: 'test_user',
        lastStatus: 'Live',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.streamer.update as jest.Mock).mockResolvedValue(mockStreamer);

      const result = await repository.updateStatus('twitch_123456', 'Live');

      expect(result).toEqual(mockStreamer);
      expect(mockPrisma.streamer.update).toHaveBeenCalledWith({
        where: { streamerId: 'twitch_123456' },
        data: { lastStatus: 'Live' },
      });
    });
  });
});

