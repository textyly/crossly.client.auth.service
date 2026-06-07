import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { AuthController } from './controllers/authController.js';
import { AuthManager } from './managers/authManager.js';
import type { IJwtSigner } from './signer/types.js';

/**
 * Builds the configured Express application (JSON middleware, /health, and the
 * auth routes) for a given JWT signer, WITHOUT binding a port.
 *
 * The entry point (app.ts) and the integration tests share this factory so they
 * exercise the same wiring; only the injected signer (and its secret) differs.
 */
export function createApp(signer: IJwtSigner): Express {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok' });
    });

    const manager = new AuthManager(signer);
    const controller = new AuthController(manager);
    app.use('/auth', controller.router);

    return app;
}
