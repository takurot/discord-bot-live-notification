import { PrismaClient, Server } from '@prisma/client';

export class ServerRepository {
  constructor(private prisma: PrismaClient) {}

  async findByServerId(serverId: string): Promise<Server | null> {
    return this.prisma.server.findUnique({
      where: { serverId },
    });
  }

  async create(serverId: string, planType: 'Free' | 'Pro' = 'Free'): Promise<Server> {
    return this.prisma.server.create({
      data: {
        serverId,
        planType,
      },
    });
  }

  async updatePlan(serverId: string, planType: 'Free' | 'Pro'): Promise<Server> {
    return this.prisma.server.update({
      where: { serverId },
      data: { planType },
    });
  }

  async findAll(): Promise<Server[]> {
    return this.prisma.server.findMany();
  }
}

