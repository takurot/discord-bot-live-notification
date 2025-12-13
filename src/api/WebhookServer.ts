import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';

import { PubSubHubbubService } from '../services/youtube/PubSubHubbubService';
import { logger } from '../utils/logger';

export class WebhookServer {
    private app: express.Application;
    private port: number;
    private pubSubHubbubService: PubSubHubbubService;

    constructor(pubSubHubbubService: PubSubHubbubService, port: number = 3000) {
        this.app = express();
        this.port = port;
        this.pubSubHubbubService = pubSubHubbubService;

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        // XML body parser for Atom feeds
        this.app.use(bodyParser.text({ type: 'application/atom+xml' }));
        // Standard JSON/URL-encoded parsers
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, _res, next) => {
            logger.debug(`${req.method} ${req.url}`);
            next();
        });
    }

    private setupRoutes(): void {
        // Verification challenge (GET)
        this.app.get('/callback', (req: Request, res: Response) => {
            this.pubSubHubbubService.handleVerification(req, res);
        });

        // Notification feed (POST)
        this.app.post('/callback', (req: Request, res: Response) => {
            this.pubSubHubbubService.handleNotification(req, res);
        });

        // Health check
        this.app.get('/health', (_req: Request, res: Response) => {
            res.status(200).send('OK');
        });
    }

    public start(): void {
        this.app.listen(this.port, () => {
            logger.info(`Webhook server listening on port ${this.port}`);
        });
    }
}
