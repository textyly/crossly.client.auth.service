import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { AuthController } from './controllers/authController.js';
import { AuthManager } from './managers/authManager.js';
import type { IJwtSigner } from './signer/types.js';
import type { IClientRepository } from './repository/types.js';

/** Collaborators the app is built from. Injected so tests can swap in fakes. */
export interface AppDependencies {
    signer: IJwtSigner;
    clients: IClientRepository;
}

/**
 * Builds the configured Express application (JSON middleware, /health, and the
 * auth routes) from its dependencies, WITHOUT binding a port.
 *
 * The entry point (app.ts) and the integration tests share this factory so they
 * exercise the same wiring; only the injected collaborators differ (a real
 * Postgres-backed repo at runtime, an in-memory one in tests).
 */
export function createApp({ signer, clients }: AppDependencies): Express {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok' });
    });

    const manager = new AuthManager(signer, clients);
    const controller = new AuthController(manager);
    app.use('/auth', controller.router);

    return app;
}
