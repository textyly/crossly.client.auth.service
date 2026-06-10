import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AuthController } from './controllers/authController.js';
import { AuthManager } from './managers/authManager.js';
import type { IJwtSigner } from './signer/types.js';
import type { IClientRepository } from './repository/types.js';
import type { IOidcProvider } from './oidc/types.js';
import type { AuthConfig } from './config.js';

/** Collaborators the app is built from. Injected so tests can swap in fakes. */
export interface AppDependencies {
    signer: IJwtSigner;
    clients: IClientRepository;
    oidc: IOidcProvider;
    config: AuthConfig;
}

/**
 * Builds the configured Express application (CORS w/ credentials, JSON + cookie
 * parsing, /health, and the auth routes) from its dependencies, WITHOUT binding
 * a port.
 *
 * The entry point (app.ts) and the integration tests share this factory so they
 * exercise the same wiring; only the injected collaborators differ (real
 * Postgres + Google at runtime; in-memory repo + fake provider in tests).
 */
export function createApp({ signer, clients, oidc, config }: AppDependencies): Express {
    const app = express();

    // Credentialed CORS so the browser sends/receives the httpOnly session cookie.
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
    app.use(express.json());
    app.use(cookieParser(config.cookieSecret));

    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok' });
    });

    const manager = new AuthManager(signer, clients);
    const controller = new AuthController(manager, oidc, config);
    app.use('/auth', controller.router);

    return app;
}
