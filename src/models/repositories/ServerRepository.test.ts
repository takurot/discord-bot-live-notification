import { PrismaClient } from '@prisma/client';
import { ServerRepository } from './ServerRepository';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    server: {
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

describe('ServerRepository', () => {
  let repository: ServerRepository;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    repository = new ServerRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('findByServerId', () => {
    it('should return server when found', async () => {
      const mockServer = {
        id: '1',
        serverId: '123456789012345678',
        planType: 'Free',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.server.findUnique as jest.Mock).mockResolvedValue(mockServer);

      const result = await repository.findByServerId('123456789012345678');

      expect(result).toEqual(mockServer);
      expect(mockPrisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId: '123456789012345678' },
      });
    });

    it('should return null when not found', async () => {
      (mockPrisma.server.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByServerId('123456789012345678');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new server', async () => {
      const mockServer = {
        id: '1',
        serverId: '123456789012345678',
        planType: 'Free' as const,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.server.create as jest.Mock).mockResolvedValue(mockServer);

      const result = await repository.create('123456789012345678', 'Free');

      expect(result).toEqual(mockServer);
      expect(mockPrisma.server.create).toHaveBeenCalledWith({
        data: {
          serverId: '123456789012345678',
          planType: 'Free',
        },
      });
    });
  });

  describe('updatePlan', () => {
    it('should update server plan', async () => {
      const mockServer = {
        id: '1',
        serverId: '123456789012345678',
        planType: 'Pro',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.server.update as jest.Mock).mockResolvedValue(mockServer);

      const result = await repository.updatePlan('123456789012345678', 'Pro');

      expect(result).toEqual(mockServer);
      expect(mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: '123456789012345678' },
        data: { planType: 'Pro' },
      });
    });
  });
});
