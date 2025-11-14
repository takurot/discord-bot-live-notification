import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // テスト用サーバーを作成
  const testServer = await prisma.server.upsert({
    where: { serverId: '123456789012345678' },
    update: {},
    create: {
      serverId: '123456789012345678',
      planType: 'Free',
    },
  });

  console.log('Created test server:', testServer);

  // テスト用配信者を作成
  const testStreamer = await prisma.streamer.upsert({
    where: { streamerId: 'twitch_123456' },
    update: {},
    create: {
      streamerId: 'twitch_123456',
      platform: 'Twitch',
      channelId: '123456',
      username: 'test_streamer',
      lastStatus: 'Offline',
    },
  });

  console.log('Created test streamer:', testStreamer);

  // テスト用サブスクリプションを作成
  const testSubscription = await prisma.subscription.upsert({
    where: {
      serverId_streamerId: {
        serverId: testServer.serverId,
        streamerId: testStreamer.streamerId,
      },
    },
    update: {},
    create: {
      serverId: testServer.serverId,
      streamerId: testStreamer.streamerId,
      notificationChannelId: '987654321098765432',
    },
  });

  console.log('Created test subscription:', testSubscription);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

