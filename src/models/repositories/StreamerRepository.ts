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

  async findAll(): Promise<Streamer[]> {
    return this.prisma.streamer.findMany();
  }
}
