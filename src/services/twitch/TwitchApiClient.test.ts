import { TwitchApiClient } from './TwitchApiClient';

// Mock fetch
global.fetch = jest.fn();

describe('TwitchApiClient', () => {
  let client: TwitchApiClient;
  const mockClientId = 'test_client_id';
  const mockClientSecret = 'test_client_secret';

  beforeEach(() => {
    client = new TwitchApiClient(mockClientId, mockClientSecret);
    jest.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('should fetch and return access token', async () => {
      const mockTokenResponse = {
        access_token: 'mock_access_token',
        expires_in: 3600,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const token = await client.getAccessToken();

      expect(token).toBe('mock_access_token');
      expect(fetch).toHaveBeenCalledWith(
        'https://id.twitch.tv/oauth2/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error when token fetch fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(client.getAccessToken()).rejects.toThrow('Failed to get Twitch access token');
    });
  });

  describe('getUserByUsername', () => {
    it('should fetch user information by username', async () => {
      const mockUserResponse = {
        data: [
          {
            id: '123456',
            login: 'test_user',
            display_name: 'Test User',
          },
        ],
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserResponse,
        });

      const user = await client.getUserByUsername('test_user');

      expect(user).toEqual({
        id: '123456',
        login: 'test_user',
        display_name: 'Test User',
      });
    });

    it('should return null when user not found', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      const user = await client.getUserByUsername('nonexistent_user');

      expect(user).toBeNull();
    });
  });

  describe('getStreamStatus', () => {
    it('should return stream information when live', async () => {
      const mockStreamResponse = {
        data: [
          {
            id: 'stream_123',
            user_id: '123456',
            user_name: 'test_user',
            game_id: '12345',
            game_name: 'Just Chatting',
            title: 'Test Stream',
            viewer_count: 100,
            started_at: '2024-01-01T00:00:00Z',
            thumbnail_url: 'https://example.com/thumb.jpg',
          },
        ],
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStreamResponse,
        });

      const stream = await client.getStreamStatus('123456');

      expect(stream).toEqual({
        isLive: true,
        title: 'Test Stream',
        gameName: 'Just Chatting',
        viewerCount: 100,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        startedAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should return isLive false when not streaming', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      const stream = await client.getStreamStatus('123456');

      expect(stream).toEqual({
        isLive: false,
        title: null,
        gameName: null,
        viewerCount: 0,
        thumbnailUrl: null,
        startedAt: null,
      });
    });
  });

  describe('getStreams', () => {
    beforeEach(() => {
      jest.spyOn(client, 'getAccessToken').mockResolvedValue('token');
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should retry when Twitch API returns error and eventually succeed', async () => {
      jest.useFakeTimers();

      const mockStreamsResponse = {
        data: [
          {
            id: 'stream_1',
            user_id: '123',
            user_login: 'takurot',
            user_name: 'Takurot',
            game_id: '111',
            game_name: 'Just Chatting',
            type: 'live',
            title: 'Hello',
            viewer_count: 10,
            started_at: '2024-01-01T00:00:00Z',
            language: 'ja',
            thumbnail_url: 'https://example.com/thumb.jpg',
            tag_ids: [],
            is_mature: false,
          },
        ],
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStreamsResponse,
        });

      const promise = client.getStreams(['123']);

      await jest.runOnlyPendingTimersAsync();

      await expect(promise).resolves.toEqual(mockStreamsResponse.data);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      jest.useFakeTimers();

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
      });

      const expectation = expect(client.getStreams(['123'])).rejects.toThrow(
        'Failed to get Twitch streams',
      );

      await jest.runAllTimersAsync();

      await expectation;
      expect(fetch).toHaveBeenCalledTimes(4);
    });
  });
});

