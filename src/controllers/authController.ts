import { Router, type CookieOptions, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { IAuthManager } from '../managers/types.js';
import type { IOidcProvider } from '../oidc/types.js';
import { type AuthConfig, OAUTH_COOKIE, SESSION_COOKIE } from '../config.js';

/** The OAuth state/PKCE cookie only needs to outlive the redirect round-trip. */
const OAUTH_COOKIE_TTL_MS = 10 * 60 * 1000;

/**
 * HTTP surface for client authentication (BFF cookie model).
 *
 * The session JWT rides in an httpOnly cookie ({@link SESSION_COOKIE}) — the
 * browser never sees it in JS — so endpoints derive identity from the cookie and
 * the UI learns who it is via `GET /auth/me`.
 *
 * Mounted under `/auth`:
 *   POST /auth/guest    -> mint a guest session; set the session cookie
 *   POST /auth/refresh  -> roll the session cookie forward
 *   GET  /auth/validate -> verify the cookie; X-Client-Id / X-Guest (gateway ForwardAuth)
 *   GET  /auth/me       -> { clientId, guest, email? } for the UI
 *   GET  /auth/login    -> begin Authorization Code + PKCE; redirect to the provider
 *   GET  /auth/callback -> finish login; promote the guest in place; set the session cookie
 *   POST /auth/logout   -> clear the session cookie (UI then mints a fresh guest)
 */
export class AuthController {
    public readonly router: Router;

    public constructor(
        private readonly manager: IAuthManager,
        private readonly oidc: IOidcProvider,
        private readonly config: AuthConfig,
    ) {
        this.router = Router();
        this.registerRoutes();
    }

    private registerRoutes(): void {
        this.router.post('/guest', this.createGuestSession);
        this.router.post('/refresh', this.refreshSession);
        this.router.get('/validate', this.validate);
        this.router.get('/me', this.me);
        this.router.get('/login', this.login);
        this.router.get('/callback', this.callback);
        this.router.post('/logout', this.logout);
    }

    private readonly createGuestSession = async (_req: Request, res: Response): Promise<void> => {
        const session = await this.manager.createGuestSession();
        this.setSessionCookie(res, session.token, session.expiresAt);
        res.status(201).json({ clientId: session.clientId, guest: true });
    };

    private readonly refreshSession = async (req: Request, res: Response): Promise<void> => {
        const token = this.sessionToken(req);
        if (!token) {
            res.status(401).json({ error: 'no session' });
            return;
        }

        try {
            const session = await this.manager.refreshSession(token);
            this.setSessionCookie(res, session.token, session.expiresAt);
            const claims = await this.manager.validate(session.token);
            res.status(200).json({ clientId: claims.sub, guest: claims.guest });
        } catch {
            this.clearSessionCookie(res);
            res.status(401).json({ error: 'invalid or expired session' });
        }
    };

    private readonly validate = async (req: Request, res: Response): Promise<void> => {
        const token = this.sessionToken(req);
        if (!token) {
            res.status(401).json({ error: 'no session' });
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
            res.status(401).json({ error: 'invalid or expired session' });
        }
    };

    private readonly me = async (req: Request, res: Response): Promise<void> => {
        const token = this.sessionToken(req);
        if (!token) {
            res.status(401).json({ error: 'no session' });
            return;
        }

        try {
            const info = await this.manager.describeSession(token);
            res.status(200).json(info);
        } catch {
            res.status(401).json({ error: 'invalid or expired session' });
        }
    };

    private readonly login = async (_req: Request, res: Response): Promise<void> => {
        // Generic, provider-agnostic CSRF state + PKCE verifier; the provider turns
        // the verifier into a code_challenge when building the authorize URL.
        const state = randomBytes(16).toString('base64url');
        const codeVerifier = randomBytes(32).toString('base64url');

        try {
            const url = await this.oidc.authorizeUrl(state, codeVerifier);
            res.cookie(OAUTH_COOKIE, JSON.stringify({ state, codeVerifier }), {
                ...this.baseCookieOptions(),
                path: '/auth',
                maxAge: OAUTH_COOKIE_TTL_MS,
                signed: true,
            });
            res.redirect(302, url);
        } catch {
            res.status(503).json({ error: 'login not configured' });
        }
    };

    private readonly callback = async (req: Request, res: Response): Promise<void> => {
        const code = typeof req.query.code === 'string' ? req.query.code : undefined;
        const state = typeof req.query.state === 'string' ? req.query.state : undefined;
        const stash = this.readOauthCookie(req);

        // The OAuth cookie is single-use.
        res.clearCookie(OAUTH_COOKIE, { path: '/auth' });

        if (!code || !state || !stash || stash.state !== state) {
            res.status(400).json({ error: 'invalid oauth callback' });
            return;
        }

        try {
            const identity = await this.oidc.exchangeCode(code, stash.codeVerifier);
            // Promote the current guest in place if one is present on this device.
            const guestClientId = await this.guestClientId(req);
            const resolved = await this.manager.resolveLogin(identity, guestClientId);

            const session = await this.manager.createAuthenticatedSession(resolved.clientId);
            // Overwriting the session cookie also "clears" the guest session.
            this.setSessionCookie(res, session.token, session.expiresAt);
            res.redirect(302, this.config.uiRedirectUrl);
        } catch {
            res.status(400).json({ error: 'login failed' });
        }
    };

    private readonly logout = async (_req: Request, res: Response): Promise<void> => {
        this.clearSessionCookie(res);
        res.status(204).end();
    };

    // --- cookie helpers ---

    private baseCookieOptions(): CookieOptions {
        return {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.config.secureCookies,
            path: '/',
        };
    }

    private setSessionCookie(res: Response, token: string, expiresAt: number): void {
        res.cookie(SESSION_COOKIE, token, {
            ...this.baseCookieOptions(),
            maxAge: Math.max(0, expiresAt * 1000 - Date.now()),
        });
    }

    private clearSessionCookie(res: Response): void {
        res.clearCookie(SESSION_COOKIE, { path: '/' });
    }

    private sessionToken(req: Request): string | undefined {
        const value = req.cookies?.[SESSION_COOKIE];
        return typeof value === 'string' && value.length > 0 ? value : undefined;
    }

    private readOauthCookie(req: Request): { state: string; codeVerifier: string } | undefined {
        const raw = req.signedCookies?.[OAUTH_COOKIE];
        if (typeof raw !== 'string') {
            return undefined;
        }
        try {
            const parsed = JSON.parse(raw) as { state?: unknown; codeVerifier?: unknown };
            if (typeof parsed.state === 'string' && typeof parsed.codeVerifier === 'string') {
                return { state: parsed.state, codeVerifier: parsed.codeVerifier };
            }
        } catch {
            // fall through
        }
        return undefined;
    }

    /** The current session's clientId iff it is a (still valid) guest — for promote-in-place. */
    private async guestClientId(req: Request): Promise<string | undefined> {
        const token = this.sessionToken(req);
        if (!token) {
            return undefined;
        }
        try {
            const claims = await this.manager.validate(token);
            return claims.guest ? claims.sub : undefined;
        } catch {
            return undefined;
        }
    }
}
