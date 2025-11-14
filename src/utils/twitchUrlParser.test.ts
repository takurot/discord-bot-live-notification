import { parseTwitchUrl } from './twitchUrlParser';

describe('parseTwitchUrl', () => {
  it('should parse full Twitch URL', () => {
    const url = 'https://www.twitch.tv/ninja';
    const result = parseTwitchUrl(url);
    expect(result).toBe('ninja');
  });

  it('should parse Twitch URL without www', () => {
    const url = 'https://twitch.tv/shroud';
    const result = parseTwitchUrl(url);
    expect(result).toBe('shroud');
  });

  it('should parse Twitch URL with trailing slash', () => {
    const url = 'https://www.twitch.tv/pokimane/';
    const result = parseTwitchUrl(url);
    expect(result).toBe('pokimane');
  });

  it('should parse Twitch URL with query parameters', () => {
    const url = 'https://www.twitch.tv/xqc?referrer=discord';
    const result = parseTwitchUrl(url);
    expect(result).toBe('xqc');
  });

  it('should parse Twitch URL with path after channel', () => {
    const url = 'https://www.twitch.tv/ninja/videos';
    const result = parseTwitchUrl(url);
    expect(result).toBe('ninja');
  });

  it('should throw error for invalid URL', () => {
    const url = 'https://youtube.com/channel123';
    expect(() => parseTwitchUrl(url)).toThrow('Invalid Twitch URL');
  });

  it('should throw error for non-URL string', () => {
    const url = 'not-a-url';
    expect(() => parseTwitchUrl(url)).toThrow('Invalid Twitch URL');
  });

  it('should throw error for empty string', () => {
    const url = '';
    expect(() => parseTwitchUrl(url)).toThrow('Invalid Twitch URL');
  });
});

