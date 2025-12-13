import { Request, Response } from 'express';
import { parseStringPromise } from 'xml2js';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { StreamerRepository } from '../../models/repositories/StreamerRepository';
import { SubscriptionRepository } from '../../models/repositories/SubscriptionRepository';

import { YouTubeApiClient } from './YouTubeApiClient';


const HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
const TOPIC_BASE_URL = 'https://www.youtube.com/xml/feeds/videos.xml?channel_id=';

export class PubSubHubbubService {
    private youtubeApiClient: YouTubeApiClient;
    private streamerRepository: StreamerRepository;
    private subscriptionRepository: SubscriptionRepository;

    private eventEmitter: EventEmitter;
    private callbackUrl: string;
    private leaseSeconds: number;

    constructor(
        youtubeApiClient: YouTubeApiClient,
        streamerRepository: StreamerRepository,
        subscriptionRepository: SubscriptionRepository,

        eventEmitter: EventEmitter,
        callbackUrl: string,
        leaseSeconds: number = 432000 // 5 days
    ) {
        this.youtubeApiClient = youtubeApiClient;
        this.streamerRepository = streamerRepository;
        this.subscriptionRepository = subscriptionRepository;

        this.eventEmitter = eventEmitter;
        this.callbackUrl = callbackUrl;
        this.leaseSeconds = leaseSeconds;
    }

    /**
     * Subscribe to a YouTube channel's feed
     */
    async subscribe(channelId: string): Promise<void> {
        const topicUrl = `${TOPIC_BASE_URL}${channelId}`;
        const params = new URLSearchParams({
            'hub.callback': this.callbackUrl,
            'hub.mode': 'subscribe',
            'hub.topic': topicUrl,
            'hub.lease_seconds': this.leaseSeconds.toString(),
            // 'hub.secret': '', // Optional: Add secret for HMAC verification later
        });

        try {
            const response = await fetch(HUB_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                throw new Error(`Failed to subscribe: ${response.statusText}`);
            }

            logger.info(`Subscribed to PubSubHubbub for channel ${channelId}`);
        } catch (error) {
            logger.error('Error subscribing to PubSubHubbub:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe from a YouTube channel's feed
     */
    async unsubscribe(channelId: string): Promise<void> {
        const topicUrl = `${TOPIC_BASE_URL}${channelId}`;
        const params = new URLSearchParams({
            'hub.callback': this.callbackUrl,
            'hub.mode': 'unsubscribe',
            'hub.topic': topicUrl,
        });

        try {
            const response = await fetch(HUB_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                throw new Error(`Failed to unsubscribe: ${response.statusText}`);
            }

            logger.info(`Unsubscribed from PubSubHubbub for channel ${channelId}`);
        } catch (error) {
            logger.error('Error unsubscribing from PubSubHubbub:', error);
            throw error;
        }
    }

    /**
     * Handle verification challenge from the Hub
     */
    handleVerification(req: Request, res: Response): void {
        const mode = req.query['hub.mode'] as string;
        const topic = req.query['hub.topic'] as string;
        const challenge = req.query['hub.challenge'] as string;
        // const leaseSeconds = req.query['hub.lease_seconds'] as string;

        if (!mode || !topic || !challenge) {
            logger.warn('Invalid verification request');
            res.status(400).send('Bad Request');
            return;
        }

        logger.info(`Received verification challenge for topic: ${topic}, mode: ${mode}`);
        res.status(200).send(challenge);
    }

    /**
     * Handle notification feed update
     */
    async handleNotification(req: Request, res: Response): Promise<void> {
        try {
            // Respond immediately to acknowledge receipt
            res.status(200).send('OK');

            const xml = req.body;
            if (!xml) return;

            const result = await parseStringPromise(xml);
            const feed = result.feed;

            if (!feed || !feed.entry || feed.entry.length === 0) {
                // Heartbeat or empty update
                return;
            }

            const entry = feed.entry[0];
            const videoId = entry['yt:videoId']?.[0];
            const channelId = entry['yt:channelId']?.[0];
            // const title = entry.title?.[0];
            // const published = entry.published?.[0];
            // const updated = entry.updated?.[0];

            // Check if this is a new video/stream or an update/deletion
            // Note: PubSubHubbub sends updates for uploads, scheduled streams, and live streams.
            // We need to verify if it's actually a live stream using the API.

            if (videoId && channelId) {
                logger.info(`Received PubSubHubbub update for video ${videoId} from channel ${channelId}`);

                // Verify with YouTube API to check if it's a live stream
                const stream = await this.youtubeApiClient.getStream(channelId);

                if (stream && stream.startedAt) {
                    // It is live!
                    // Check if we already notified? 
                    // The polling service handles the "state change" logic (Offline -> Live).
                    // Here we can either:
                    // 1. Update the DB status to 'Live' immediately so polling service picks it up faster?
                    // 2. Emit the event directly?

                    // For now, let's update the DB and emit the event if it wasn't already Live.

                    const streamer = await this.streamerRepository.findByStreamerId(channelId);
                    if (streamer) {
                        const wasLive = streamer.lastStatus === 'Live';

                        if (!wasLive) {
                            logger.info(`PubSubHubbub detected stream start: ${streamer.username}`);
                            await this.streamerRepository.updateStatus(streamer.streamerId, 'Live');

                            const subscriptions = await this.subscriptionRepository.findByStreamerId(
                                streamer.streamerId
                            );

                            this.eventEmitter.emit('streamStarted', {
                                streamer: { ...streamer, lastStatus: 'Live' },
                                streamData: stream,
                                subscriptions,
                            });
                        } else {
                            logger.info(`Streamer ${streamer.username} is already marked as Live. Skipping notification.`);
                        }
                    }
                } else {
                    // Stream ended or it's just a video upload
                    // If it was live, mark as offline
                    const streamer = await this.streamerRepository.findByStreamerId(channelId);
                    if (streamer && streamer.lastStatus === 'Live') {
                        // Verify it's actually offline (double check)
                        // If API returns null, it's offline.
                        if (!stream) {
                            logger.info(`PubSubHubbub detected stream end: ${streamer.username}`);
                            await this.streamerRepository.updateStatus(streamer.streamerId, 'Offline');

                            const subscriptions = await this.subscriptionRepository.findByStreamerId(
                                streamer.streamerId
                            );

                            this.eventEmitter.emit('streamEnded', {
                                streamer: { ...streamer, lastStatus: 'Offline' },
                                subscriptions,
                            });
                        }
                    }
                }
            }

        } catch (error) {
            logger.error('Error handling PubSubHubbub notification:', error);
        }
    }
}
