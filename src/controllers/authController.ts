import { Router, type Request, type Response } from 'express';
import type { IAuthManager } from '../managers/types.js';

/**
 * HTTP surface for client authentication. Translates requests/responses and
 * delegates all work to the {@link IAuthManager}.
 *
 * Mounted under `/auth`:
 *   POST /auth/guest  -> create a new anonymous guest session
 */
export class AuthController {
    public readonly router: Router;

    public constructor(private readonly manager: IAuthManager) {
        this.router = Router();
        this.registerRoutes();
    }

    private registerRoutes(): void {
        this.router.post('/guest', this.createGuestSession);
    }

    private readonly createGuestSession = async (_req: Request, res: Response): Promise<void> => {
        const session = await this.manager.createGuestSession();
        res.status(201).json(session);
    };
}
