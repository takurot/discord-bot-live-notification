import { logger } from '../../utils/logger';
import { retryWithExponentialBackoff } from '../../utils/retry';

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
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

export class TwitchApiClient {
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
   * ユーザー名からユーザー情報を取得
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
    const token = await this.getAccessToken();

    const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      logger.error('Failed to get Twitch stream status', {
        userId,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Failed to get Twitch stream status: ${userId}`);
    }

    const data = (await response.json()) as {
      data: Array<{
        id: string;
        user_id: string;
        user_name: string;
        game_id: string;
        game_name: string;
        title: string;
        viewer_count: number;
        started_at: string;
        thumbnail_url: string;
      }>;
    };

    if (data.data.length === 0) {
      return {
        isLive: false,
        title: null,
        gameName: null,
        viewerCount: 0,
        thumbnailUrl: null,
        startedAt: null,
      };
    }

    const stream = data.data[0];
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
