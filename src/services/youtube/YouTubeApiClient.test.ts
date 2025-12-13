import { YouTubeApiClient } from './YouTubeApiClient';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger');

// Mock fetch
global.fetch = jest.fn();

describe('YouTubeApiClient', () => {
  let client: YouTubeApiClient;
  const apiKey = 'test-api-key';

  beforeEach(() => {
    client = new YouTubeApiClient(apiKey);
    jest.clearAllMocks();
  });

  describe('getChannel', () => {
    it('should return channel info when searching by handle', async () => {
      const mockResponse = {
        items: [
          {
            id: 'UC12345',
            snippet: {
              title: 'Test Channel',
              customUrl: '@testchannel',
              thumbnails: {
                default: { url: 'http://example.com/default.jpg' },
                medium: { url: 'http://example.com/medium.jpg' },
                high: { url: 'http://example.com/high.jpg' },
              },
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getChannel('@testchannel');

      expect(result).toEqual({
        id: 'UC12345',
        title: 'Test Channel',
        customUrl: '@testchannel',
        thumbnailUrl: 'http://example.com/high.jpg',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://www.googleapis.com/youtube/v3/channels')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('forHandle=%40testchannel')
      );
    });

    it('should return channel info when searching by ID', async () => {
      const channelId = 'UC1234567890123456789012';
      const mockResponse = {
        items: [
          {
            id: channelId,
            snippet: {
              title: 'Test Channel',
              customUrl: '@testchannel',
              thumbnails: {
                default: { url: 'http://example.com/default.jpg' },
                medium: { url: 'http://example.com/medium.jpg' },
                high: { url: 'http://example.com/high.jpg' },
              },
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getChannel(channelId);

      expect(result).toEqual({
        id: channelId,
        title: 'Test Channel',
        customUrl: '@testchannel',
        thumbnailUrl: 'http://example.com/high.jpg',
      });
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`id=${channelId}`));
    });

    it('should return null if channel not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await client.getChannel('@nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(client.getChannel('@test')).rejects.toThrow('Failed to get YouTube channel');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get YouTube channel'),
        expect.any(Object)
      );
    });
  });

  describe('getStreamStatus', () => {
    it('should return live status if stream is found', async () => {
      const mockResponse = {
        items: [
          {
            id: { videoId: 'video123' },
            snippet: {
              title: 'Live Stream Title',
              channelTitle: 'Test Channel',
              thumbnails: {
                high: { url: 'http://example.com/thumb.jpg' },
              },
              publishTime: '2023-01-01T00:00:00Z',
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getStreamStatus('UC12345');

      expect(result).toEqual({
        isLive: true,
        videoId: 'video123',
        title: 'Live Stream Title',
        thumbnailUrl: 'http://example.com/thumb.jpg',
        startedAt: '2023-01-01T00:00:00Z',
      });
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('eventType=live'));
    });

    it('should return offline status if no stream found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await client.getStreamStatus('UC12345');

      expect(result).toEqual({
        isLive: false,
        videoId: null,
        title: null,
        thumbnailUrl: null,
        startedAt: null,
      });
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getStreamStatus('UC12345')).rejects.toThrow(
        'Failed to get YouTube stream status'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get YouTube stream status'),
        expect.any(Object)
      );
    });
  });

  describe('getVideoDetails', () => {
    it('should return video details', async () => {
      const mockResponse = {
        items: [
          {
            id: 'video123',
            snippet: {
              title: 'Video Title',
              channelId: 'UC12345',
              channelTitle: 'Test Channel',
              thumbnails: {
                high: { url: 'http://example.com/thumb.jpg' },
              },
              publishedAt: '2023-01-01T00:00:00Z',
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getVideoDetails('video123');

      expect(result).toEqual({
        id: 'video123',
        title: 'Video Title',
        channelId: 'UC12345',
        channelTitle: 'Test Channel',
        thumbnailUrl: 'http://example.com/thumb.jpg',
        publishedAt: '2023-01-01T00:00:00Z',
        viewerCount: 0,
        isLive: false,
      });
    });

    it('should return null if video not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await client.getVideoDetails('nonexistent');

      expect(result).toBeNull();
    });
  });
});
