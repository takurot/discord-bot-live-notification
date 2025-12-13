import { logger } from '../../utils/logger';
import { StreamProvider, StreamProviderUser, StreamProviderStream } from '../common/StreamProvider';

export interface YouTubeChannel {
  id: string;
  title: string;
  customUrl: string;
  thumbnailUrl: string;
}

export interface YouTubeStreamStatus {
  isLive: boolean;
  videoId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  startedAt: string | null;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewerCount?: number;
  isLive?: boolean; // Indicates if the video is currently live
}

export class YouTubeApiClient implements StreamProvider {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private hasItemsArray(data: unknown): data is { items: unknown[] } {
    if (typeof data !== 'object' || data === null) return false;
    if (!('items' in data)) return false;
    const items = (data as { items?: unknown }).items;
    return Array.isArray(items);
  }

  private isChannelsResponse(data: unknown): data is {
    items: Array<{
      id: string;
      snippet: {
        title: string;
        customUrl?: string;
        thumbnails: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  } {
    return this.hasItemsArray(data);
  }

  private isSearchResponse(data: unknown): data is {
    items: Array<{
      id: { videoId?: string };
      snippet: {
        title?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
        publishTime?: string;
      };
    }>;
  } {
    return this.hasItemsArray(data);
  }

  private isVideosResponse(data: unknown): data is {
    items: Array<{
      id: string;
      snippet: {
        title: string;
        channelId: string;
        channelTitle: string;
        thumbnails: { high?: { url?: string }; medium?: { url?: string } };
        publishedAt: string;
      };
      liveStreamingDetails?: {
        actualStartTime?: string;
        actualEndTime?: string;
        concurrentViewers?: string;
      };
    }>;
  } {
    return this.hasItemsArray(data);
  }

  /**
   * StreamProvider implementation: Get user by ID or name
   */
  async getUser(idOrName: string): Promise<StreamProviderUser | null> {
    const channel = await this.getChannel(idOrName);
    if (!channel) return null;

    return {
      id: channel.id,
      name: channel.customUrl || channel.title, // YouTube doesn't always have a "username" like Twitch
      displayName: channel.title,
      url: `https://www.youtube.com/${channel.customUrl || 'channel/' + channel.id}`,
      thumbnailUrl: channel.thumbnailUrl,
    };
  }

  /**
   * StreamProvider implementation: Get stream status
   * Uses a two-step approach for reliability:
   * 1. Search API to find live streams (can be flaky)
   * 2. Videos API to verify the stream is actually live
   */
  async getStream(userId: string): Promise<StreamProviderStream | null> {
    try {
      const status = await this.getStreamStatus(userId);

      if (!status.isLive || !status.videoId) {
        return null;
      }

      // Verify the stream is actually live using Videos API
      const video = await this.getVideoDetails(status.videoId);

      // Check if the video is actually live
      if (!video || !video.isLive) {
        // Video exists but is not live (could be a premiere or past stream)
        logger.warn('YouTube video found but not currently live', {
          videoId: status.videoId,
          channelId: userId,
          isLive: video?.isLive,
        });
        return null;
      }

      return {
        id: status.videoId,
        userId: userId,
        userDisplayName: video.channelTitle || 'Unknown',
        title: status.title || video.title || 'Unknown',
        gameName: null, // YouTube doesn't have game categories in the same way
        viewerCount: video.viewerCount || 0,
        startedAt: status.startedAt || video.publishedAt,
        thumbnailUrl: status.thumbnailUrl || video.thumbnailUrl || '',
      };
    } catch (error) {
      logger.error('Error getting YouTube stream status', {
        error,
        channelId: userId,
      });
      throw error; // Throw error so polling service knows it failed, rather than assuming offline
    }
  }

  /**
   * チャンネル情報を取得 (Handle or ID)
   */
  async getChannel(handleOrId: string): Promise<YouTubeChannel | null> {
    let url = `${this.baseUrl}/channels?part=snippet&key=${this.apiKey}`;

    if (handleOrId.startsWith('UC') && handleOrId.length === 24) {
      url += `&id=${handleOrId}`;
    } else {
      // Handle search (e.g. @username)
      url += `&forHandle=${encodeURIComponent(handleOrId)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      logger.error('Failed to get YouTube channel', {
        handleOrId,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Failed to get YouTube channel: ${handleOrId}`);
    }

    const data: unknown = await response.json();

    if (!this.isChannelsResponse(data) || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    return {
      id: item.id,
      title: item.snippet.title,
      customUrl: item.snippet.customUrl ?? '',
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
    };
  }

  /**
   * チャンネルの現在の配信状況を取得 (Search API)
   * Note: Search API has high quota cost (100 units)
   */
  async getStreamStatus(channelId: string): Promise<YouTubeStreamStatus> {
    const url = `${this.baseUrl}/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${this.apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      logger.error('Failed to get YouTube stream status', {
        channelId,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Failed to get YouTube stream status: ${channelId}`);
    }

    const data: unknown = await response.json();

    if (!this.isSearchResponse(data) || data.items.length === 0) {
      return {
        isLive: false,
        videoId: null,
        title: null,
        thumbnailUrl: null,
        startedAt: null,
      };
    }

    const item = data.items[0];
    return {
      isLive: true,
      videoId: item.id.videoId ?? null,
      title: item.snippet.title ?? null,
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || null,
      startedAt: item.snippet.publishTime ?? null,
    };
  }

  /**
   * 動画詳細を取得
   */
  async getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
    // liveStreamingDetails for concurrentViewers
    const url = `${this.baseUrl}/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${this.apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      logger.error('Failed to get YouTube video details', {
        videoId,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Failed to get YouTube video details: ${videoId}`);
    }

    const data: unknown = await response.json();

    if (!this.isVideosResponse(data) || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    const liveDetails = item.liveStreamingDetails;
    const isLive = !!liveDetails?.actualStartTime && !liveDetails?.actualEndTime;

    return {
      id: item.id,
      title: item.snippet.title ?? '',
      channelId: item.snippet.channelId ?? '',
      channelTitle: item.snippet.channelTitle ?? '',
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
      publishedAt: item.snippet.publishedAt ?? '',
      viewerCount: liveDetails?.concurrentViewers ? parseInt(liveDetails.concurrentViewers, 10) : 0,
      isLive: isLive,
    };
  }
}
