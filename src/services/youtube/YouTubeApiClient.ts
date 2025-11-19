import { logger } from '../../utils/logger';

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
}

export class YouTubeApiClient {
    private apiKey: string;
    private baseUrl = 'https://www.googleapis.com/youtube/v3';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
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

        const data = (await response.json()) as any;

        if (!data.items || data.items.length === 0) {
            return null;
        }

        const item = data.items[0];
        return {
            id: item.id,
            title: item.snippet.title,
            customUrl: item.snippet.customUrl,
            thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
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

        const data = (await response.json()) as any;

        if (!data.items || data.items.length === 0) {
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
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
            startedAt: item.snippet.publishTime,
        };
    }

    /**
     * 動画詳細を取得
     */
    async getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
        const url = `${this.baseUrl}/videos?part=snippet&id=${videoId}&key=${this.apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            logger.error('Failed to get YouTube video details', {
                videoId,
                status: response.status,
                statusText: response.statusText,
            });
            throw new Error(`Failed to get YouTube video details: ${videoId}`);
        }

        const data = (await response.json()) as any;

        if (!data.items || data.items.length === 0) {
            return null;
        }

        const item = data.items[0];
        return {
            id: item.id,
            title: item.snippet.title,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
            publishedAt: item.snippet.publishedAt,
        };
    }
}
