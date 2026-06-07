import { Router, type Request, type Response } from 'express';
import type { IAuthManager } from '../managers/types.js';

/**
 * HTTP surface for client authentication. Translates requests/responses and
 * delegates all work to the {@link IAuthManager}.
 *
 * Mounted under `/auth`:
 *   POST /auth/guest    -> create a new anonymous guest session
 *   POST /auth/refresh  -> roll an existing session forward (Authorization: Bearer <token>)
 *   GET  /auth/validate -> verify a token; returns X-Client-Id / X-Guest headers (for gateway ForwardAuth)
 */
export class AuthController {
    public readonly router: Router;

    public constructor(private readonly manager: IAuthManager) {
        this.router = Router();
        this.registerRoutes();
    }

    private registerRoutes(): void {
        this.router.post('/guest', this.createGuestSession);
        this.router.post('/refresh', this.refreshSession);
        this.router.get('/validate', this.validate);
    }

    private readonly createGuestSession = async (_req: Request, res: Response): Promise<void> => {
        const session = await this.manager.createGuestSession();
        res.status(201).json(session);
    };

    private readonly refreshSession = async (req: Request, res: Response): Promise<void> => {
        const token = this.extractBearerToken(req);
        if (!token) {
            res.status(401).json({ error: 'missing or malformed Authorization header' });
            return;
        }

        try {
            const session = await this.manager.refreshSession(token);
            res.status(200).json(session);
        } catch {
            res.status(401).json({ error: 'invalid or expired token' });
        }
    };

    private readonly validate = async (req: Request, res: Response): Promise<void> => {
        const token = this.extractBearerToken(req);
        if (!token) {
            res.status(401).json({ error: 'missing or malformed Authorization header' });
            return;
        }

        try {
            const claims = await this.manager.validate(token);
            // The gateway (ForwardAuth) copies these onto the proxied request so
            // downstream services receive a trusted identity they didn't have to verify.
            res.setHeader('X-Client-Id', claims.sub);
            res.setHeader('X-Guest', String(claims.guest));
            res.status(200).json({ clientId: claims.sub, guest: claims.guest });
        } catch {
            res.status(401).json({ error: 'invalid or expired token' });
        }
    };

    private extractBearerToken(req: Request): string | undefined {
        const header = req.header('authorization') ?? '';
        const [scheme, value] = header.split(' ');
        return scheme.toLowerCase() === 'bearer' && value ? value : undefined;
    }
}
