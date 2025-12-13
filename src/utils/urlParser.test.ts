import { detectPlatform, parseTwitchUrl, parseYoutubeUrl } from './urlParser';

describe('urlParser', () => {
  describe('detectPlatform', () => {
    it('should detect Twitch platform', () => {
      expect(detectPlatform('https://www.twitch.tv/ninja')).toBe('Twitch');
      expect(detectPlatform('twitch.tv/shroud')).toBe('Twitch');
    });

    it('should detect YouTube platform', () => {
      expect(detectPlatform('https://www.youtube.com/@YouTube')).toBe('YouTube');
      expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('YouTube');
    });

    it('should return null for unknown platform', () => {
      expect(detectPlatform('https://google.com')).toBeNull();
      expect(detectPlatform('invalid')).toBeNull();
    });
  });

  describe('parseTwitchUrl', () => {
    it('should parse valid Twitch URL', () => {
      expect(parseTwitchUrl('https://www.twitch.tv/ninja')).toBe('ninja');
      expect(parseTwitchUrl('https://twitch.tv/shroud/videos')).toBe('shroud');
    });

    it('should return null for invalid Twitch URL', () => {
      expect(parseTwitchUrl('https://google.com')).toBeNull();
      expect(parseTwitchUrl('https://www.twitch.tv/')).toBeNull();
    });
  });

  describe('parseYoutubeUrl', () => {
    it('should parse YouTube handle', () => {
      expect(parseYoutubeUrl('https://www.youtube.com/@YouTube')).toBe('@YouTube');
      expect(parseYoutubeUrl('https://youtube.com/@pewdiepie')).toBe('@pewdiepie');
    });

    it('should parse YouTube channel ID', () => {
      expect(parseYoutubeUrl('https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw')).toBe(
        'UC-lHJZR3Gqxm24_Vd_AJ5Yw'
      );
    });

    it('should parse YouTube custom URL', () => {
      expect(parseYoutubeUrl('https://www.youtube.com/c/YouTubeCreators')).toBe('YouTubeCreators');
      expect(parseYoutubeUrl('https://www.youtube.com/user/YouTube')).toBe('YouTube');
    });

    it('should return null for invalid YouTube URL', () => {
      expect(parseYoutubeUrl('https://google.com')).toBeNull();
      expect(parseYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull(); // Currently not supporting video URLs for channel parsing
    });
  });
});
