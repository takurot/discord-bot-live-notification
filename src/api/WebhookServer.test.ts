import request from 'supertest';
import { WebhookServer } from './WebhookServer';
import { PubSubHubbubService } from '../services/youtube/PubSubHubbubService';
import express from 'express';

// Mock PubSubHubbubService
jest.mock('../services/youtube/PubSubHubbubService');

describe('WebhookServer', () => {
  let webhookServer: WebhookServer;
  let mockPubSubHubbubService: jest.Mocked<PubSubHubbubService>;
  let app: express.Application;

  beforeEach(() => {
    mockPubSubHubbubService = new PubSubHubbubService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      'http://localhost:3000/callback'
    ) as jest.Mocked<PubSubHubbubService>;

    // Mock methods
    mockPubSubHubbubService.handleVerification = jest.fn((_req, res) => {
      res.status(200).send('challenge');
    });
    mockPubSubHubbubService.handleNotification = jest.fn(async (_req, res) => {
      res.status(200).send('ok');
    });

    webhookServer = new WebhookServer(mockPubSubHubbubService, 3000);
    // Access private app for testing
    app = (webhookServer as any).app;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /callback', () => {
    it('should delegate to PubSubHubbubService.handleVerification', async () => {
      await request(app)
        .get('/callback')
        .query({ 'hub.challenge': 'challenge' })
        .expect(200)
        .expect('challenge');

      expect(mockPubSubHubbubService.handleVerification).toHaveBeenCalled();
    });
  });

  describe('POST /callback', () => {
    it('should delegate to PubSubHubbubService.handleNotification', async () => {
      await request(app)
        .post('/callback')
        .set('Content-Type', 'application/atom+xml')
        .send('<feed></feed>')
        .expect(200)
        .expect('ok');

      expect(mockPubSubHubbubService.handleNotification).toHaveBeenCalled();
    });
  });
});
