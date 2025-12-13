import { logger } from '../../utils/logger';
import { retryWithExponentialBackoff } from '../../utils/retry';
import { StreamProvider, StreamProviderUser, StreamProviderStream } from '../common/StreamProvider';

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export interface TwitchStreamStatus {
  isLive: boolean;
  title: string | null;
  gameName: string | null;
  viewerCount: number;
  thumbnailUrl: string | null;
  startedAt: string | null;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids: string[];
  is_mature: boolean;
}

export class TwitchApiClient implements StreamProvider {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * OAuth2 App Access Tokenを取得（Client Credentials Flow）
   */
  async getAccessToken(): Promise<string> {
    // トークンが有効な場合は再利用
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      logger.error('Failed to get Twitch access token', {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error('Failed to get Twitch access token');
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    // 有効期限の5分前に期限切れとみなす
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

    return this.accessToken;
  }

  /**
   * StreamProvider implementation: Get user by ID or name
   */
  async getUser(idOrName: string): Promise<StreamProviderUser | null> {
    // Twitch usernames are 4-25 characters, alphanumeric + underscores.
    // IDs are numeric.
    // However, to be safe, we can try both or rely on a heuristic.
    // For now, let's assume if it's all digits, it's an ID, otherwise a username.
    // But usernames can't start with a number? Actually they can't be all numbers?
    // Twitch usernames must start with a letter. So if it starts with a digit, it's an ID.
    // Wait, is that true? "Usernames must be between 4 and 25 characters."
    // "Usernames may include alphanumeric characters and underscores."
    // It doesn't explicitly say it must start with a letter, but usually they do.
    // Let's try to query by login first, if fails or returns nothing, maybe try ID?
    // Actually, the `helix/users` endpoint allows mixing `id` and `login`.

    const isId = /^\d+$/.test(idOrName);
    const paramName = isId ? 'id' : 'login';

    const token = await this.getAccessToken();
    const response = await fetch(`https://api.twitch.tv/helix/users?${paramName}=${idOrName}`, {
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      logger.error('Failed to get Twitch user', {
        idOrName,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = (await response.json()) as { data: TwitchUser[] };

    if (data.data.length === 0) {
      return null;
    }

    const user = data.data[0];
    return {
      id: user.id,
      name: user.login,
      displayName: user.display_name,
      url: `https://www.twitch.tv/${user.login}`,
      thumbnailUrl: user.profile_image_url,
    };
  }

  /**
   * StreamProvider implementation: Get stream status
   */
  async getStream(userId: string): Promise<StreamProviderStream | null> {
    const status = await this.getStreamStatus(userId);

    if (!status.isLive) {
      return null;
    }

    // We need a bit more info than getStreamStatus returns to fully populate StreamProviderStream
    // But getStreamStatus calls the API which returns everything.
    // Let's reuse the API call logic or call getStreamStatus and accept some missing fields if necessary?
    // Actually, getStreamStatus returns a simplified object.
    // I should probably refactor getStreamStatus to return the full object or just duplicate the logic/call `getStreams`.

    // Let's use `getStreams` which returns the full object.
    const streams = await this.getStreams([userId]);
    if (streams.length === 0) {
      return null;
    }

    const stream = streams[0];
    return {
      id: stream.id,
      userId: stream.user_id,
      userDisplayName: stream.user_name,
      title: stream.title,
      gameName: stream.game_name,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      thumbnailUrl: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
    };
  }

  /**
   * ユーザー名からユーザー情報を取得
   * @deprecated Use getUser instead
   */
  async getUserByUsername(username: string): Promise<TwitchUser | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      logger.error('Failed to get Twitch user', {
        username,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Failed to get Twitch user: ${username}`);
    }

    const data = (await response.json()) as { data: TwitchUser[] };

    if (data.data.length === 0) {
      return null;
    }

    return data.data[0];
  }

  /**
   * 複数のユーザー名からユーザー情報を取得
   */
  async getUsers(usernames: string[]): Promise<TwitchUser[]> {
    if (usernames.length === 0) {
      return [];
    }

    const token = await this.getAccessToken();
    const loginParams = usernames.map((u) => `login=${u}`).join('&');

    const response = await fetch(`https://api.twitch.tv/helix/users?${loginParams}`, {
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      logger.error('Failed to get Twitch users', {
        usernames,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Failed to get Twitch users: ${usernames.join(', ')}`);
    }

    const data = (await response.json()) as { data: TwitchUser[] };
    return data.data;
  }

  /**
   * 配信ステータスを取得
   */
  async getStreamStatus(userId: string): Promise<TwitchStreamStatus> {
    const streams = await this.getStreams([userId]);

    if (streams.length === 0) {
      return {
        isLive: false,
        title: null,
        gameName: null,
        viewerCount: 0,
        thumbnailUrl: null,
        startedAt: null,
      };
    }

    const stream = streams[0];
    return {
      isLive: true,
      title: stream.title,
      gameName: stream.game_name,
      viewerCount: stream.viewer_count,
      thumbnailUrl: stream.thumbnail_url,
      startedAt: stream.started_at,
    };
  }

  /**
   * 複数のユーザーIDの配信情報を取得（最大100件）
   */
  async getStreams(userIds: string[]): Promise<TwitchStream[]> {
    if (userIds.length === 0) {
      return [];
    }

    const token = await this.getAccessToken();
    const userIdParams = userIds
      .slice(0, 100)
      .map((id) => `user_id=${id}`)
      .join('&');

    const data = await retryWithExponentialBackoff(
      async () => {
        const response = await fetch(`https://api.twitch.tv/helix/streams?${userIdParams}`, {
          headers: {
            'Client-ID': this.clientId,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          logger.error('Failed to get Twitch streams', {
            userIds,
            status: response.status,
            statusText: response.statusText,
          });
          throw new Error(`Failed to get Twitch streams`);
        }

        return (await response.json()) as { data: TwitchStream[] };
      },
      {
        operationName: 'getStreams',
      }
    );

    return data.data;
  }
}
