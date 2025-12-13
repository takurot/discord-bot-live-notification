import { PrismaClient, Subscription } from '@prisma/client';

export interface CreateSubscriptionData {
  serverId: string;
  streamerId: string;
  notificationChannelId: string;
  customMessage?: string | null;
  mentionRoleId?: string | null;
}

export interface SubscriptionWithStreamer extends Subscription {
  streamer: {
    id: string;
    streamerId: string;
    platform: string;
    channelId: string;
    username: string;
    lastStatus: string;
  };
}

export class SubscriptionRepository {
  constructor(private prisma: PrismaClient) { }

  async findByServerId(serverId: string): Promise<SubscriptionWithStreamer[]> {
    return this.prisma.subscription.findMany({
      where: { serverId },
      include: {
        streamer: true,
      },
    });
  }

  async create(data: CreateSubscriptionData): Promise<Subscription> {
    return this.prisma.subscription.create({
      data: {
        serverId: data.serverId,
        streamerId: data.streamerId,
        notificationChannelId: data.notificationChannelId,
        customMessage: data.customMessage,
        mentionRoleId: data.mentionRoleId,
      },
    });
  }

  async delete(serverId: string, streamerId: string): Promise<Subscription> {
    return this.prisma.subscription.delete({
      where: {
        serverId_streamerId: {
          serverId,
          streamerId,
        },
      },
    });
  }

  async findByServerAndStreamer(
    serverId: string,
    streamerId: string
  ): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({
      where: {
        serverId_streamerId: {
          serverId,
          streamerId,
        },
      },
    });
  }

  async countByServerId(serverId: string): Promise<number> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { serverId },
      select: { id: true },
    });
    return subscriptions.length;
  }

  async countByStreamerId(streamerId: string): Promise<number> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { streamerId },
      select: { id: true },
    });
    return subscriptions.length;
  }

  async updateNotificationMessageId(
    serverId: string,
    streamerId: string,
    messageId: string | null
  ): Promise<Subscription> {
    return this.prisma.subscription.update({
      where: {
        serverId_streamerId: {
          serverId,
          streamerId,
        },
      },
      data: {
        notificationMessageId: messageId,
      },
    });
  }

  async findAll(): Promise<Subscription[]> {
    return this.prisma.subscription.findMany();
  }
}
