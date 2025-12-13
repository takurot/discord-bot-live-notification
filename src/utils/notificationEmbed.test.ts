import { createLiveNotificationEmbed } from './notificationEmbed';

describe('createLiveNotificationEmbed', () => {
  it('should create embed for Twitch live notification', () => {
    const embed = createLiveNotificationEmbed({
      platform: 'Twitch',
      username: 'Ninja',
      streamTitle: 'ランクマッチでダイヤモンドを目指す耐久配信！',
      game: 'Valorant',
      thumbnailUrl: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_ninja-1920x1080.jpg',
      streamUrl: 'https://www.twitch.tv/ninja',
      viewerCount: 1234,
    });

    expect(embed.data.title).toBe('🔴 Ninja が配信を開始しました！');
    expect(embed.data.description).toBe('ランクマッチでダイヤモンドを目指す耐久配信！');
    expect(embed.data.color).toBe(0x9146ff); // Twitch purple
    expect(embed.data.url).toBe('https://www.twitch.tv/ninja');
    expect(embed.data.thumbnail).toBeDefined();
    expect(embed.data.thumbnail?.url).toBe(
      'https://static-cdn.jtvnw.net/previews-ttv/live_user_ninja-1920x1080.jpg'
    );
    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.fields?.[0]?.name).toBe('カテゴリ');
    expect(embed.data.fields?.[0]?.value).toBe('Valorant');
    expect(embed.data.fields?.[1]?.name).toBe('視聴者数');
    expect(embed.data.fields?.[1]?.value).toBe('1,234人');
  });

  it('should create embed for YouTube live notification', () => {
    const embed = createLiveNotificationEmbed({
      platform: 'YouTube',
      username: 'Test Channel',
      streamTitle: 'テスト配信',
      game: null,
      thumbnailUrl: 'https://i.ytimg.com/vi/test123/maxresdefault.jpg',
      streamUrl: 'https://www.youtube.com/watch?v=test123',
      viewerCount: null,
    });

    expect(embed.data.title).toBe('🔴 Test Channel が配信を開始しました！');
    expect(embed.data.description).toBe('テスト配信');
    expect(embed.data.color).toBe(0xff0000); // YouTube red
    expect(embed.data.url).toBe('https://www.youtube.com/watch?v=test123');
  });

  it('should handle missing optional fields', () => {
    const embed = createLiveNotificationEmbed({
      platform: 'Twitch',
      username: 'TestUser',
      streamTitle: 'Test Stream',
      game: null,
      thumbnailUrl: null,
      streamUrl: 'https://www.twitch.tv/testuser',
      viewerCount: null,
    });

    expect(embed.data.title).toBe('🔴 TestUser が配信を開始しました！');
    expect(embed.data.fields).toBeUndefined();
    expect(embed.data.thumbnail).toBeUndefined();
  });

  it('should format large viewer counts correctly', () => {
    const embed = createLiveNotificationEmbed({
      platform: 'Twitch',
      username: 'PopularStreamer',
      streamTitle: 'Popular Stream',
      game: 'Just Chatting',
      thumbnailUrl: null,
      streamUrl: 'https://www.twitch.tv/popularstreamer',
      viewerCount: 123456,
    });

    const viewerField = embed.data.fields?.find((f: { name: string }) => f.name === '視聴者数');
    expect(viewerField?.value).toBe('123,456人');
  });
});
