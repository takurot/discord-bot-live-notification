import { PrismaClient, Streamer } from '@prisma/client';

export interface CreateStreamerData {
  streamerId: string;
  platform: 'Twitch' | 'YouTube';
  channelId: string;
  username: string;
}

export class StreamerRepository {
  constructor(private prisma: PrismaClient) {}

  async findByStreamerId(streamerId: string): Promise<Streamer | null> {
    return this.prisma.streamer.findUnique({
      where: { streamerId },
    });
  }

  async create(data: CreateStreamerData): Promise<Streamer> {
    return this.prisma.streamer.create({
      data: {
        streamerId: data.streamerId,
        platform: data.platform,
        channelId: data.channelId,
        username: data.username,
        lastStatus: 'Offline',
      },
    });
  }

  async updateStatus(streamerId: string, status: 'Live' | 'Offline'): Promise<Streamer> {
    return this.prisma.streamer.update({
      where: { streamerId },
      data: { lastStatus: status },
    });
  }

  async findByPlatformAndChannelId(
    platform: 'Twitch' | 'YouTube',
    channelId: string,
    options?: {
      streamerId?: string;
      additionalChannelIds?: string[];
    }
  ): Promise<Streamer | null> {
    const candidateChannelIds = Array.from(
      new Set(
        [channelId, ...(options?.additionalChannelIds ?? [])].filter(
          (value): value is string => Boolean(value)
        )
      )
    );

    if (platform === 'YouTube') {
      const orConditions = [];

      if (candidateChannelIds.length > 0) {
        orConditions.push({
          channelId: candidateChannelIds.length === 1
            ? candidateChannelIds[0]
            : { in: candidateChannelIds },
        });
      }

      if (options?.streamerId) {
        orConditions.push({ streamerId: options.streamerId });
      }

      return this.prisma.streamer.findFirst({
        where: {
          platform,
          OR: orConditions.length > 0 ? orConditions : undefined,
        },
      });
    }

    return this.prisma.streamer.findFirst({
      where: {
        platform,
        channelId,
      },
    });
  }

  async findAll(): Promise<Streamer[]> {
    return this.prisma.streamer.findMany();
  }
}
