import { randomUUID } from 'node:crypto';
import type { AccessTokenClaims, GuestSessionResponse } from '@textyly/crossly-client-auth-contracts';
import type { IAuthManager } from './types.js';
import type { IJwtSigner } from '../signer/types.js';

/**
 * Sessions are valid for 1 year. Combined with refresh-on-use
 * ({@link AuthManager.refreshSession}), an active anonymous user effectively
 * never loses their session — it only lapses after a full year of inactivity.
 */
const SESSION_TTL_SECONDS: number = 60 * 60 * 24 * 365;

/**
 * Default {@link IAuthManager} implementation.
 *
 * - {@link createGuestSession} mints a brand-new anonymous session (new clientId).
 * - {@link refreshSession} re-issues a token for an existing session, preserving
 *   its identity but resetting the expiry (a sliding/rolling session).
 * - {@link validate} verifies a token and returns its claims (used by the gateway).
 *
 * Token signing/verification is delegated to the injected {@link IJwtSigner}.
 */
export class AuthManager implements IAuthManager {
    public constructor(private readonly signer: IJwtSigner) {}

    public async createGuestSession(): Promise<GuestSessionResponse> {
        const clientId = randomUUID();
        const { token, expiresAt } = await this.signer.sign(clientId, true, SESSION_TTL_SECONDS);

        return { token, clientId, expiresAt };
    }

    public async refreshSession(token: string): Promise<GuestSessionResponse> {
        // Verify the current token; throws if it is invalid or expired.
        const claims = await this.signer.verify(token);

        // Re-issue for the SAME identity with a fresh expiry, so an active user's
        // session keeps rolling forward.
        const reissued = await this.signer.sign(claims.sub, claims.guest, SESSION_TTL_SECONDS);

        return { token: reissued.token, clientId: claims.sub, expiresAt: reissued.expiresAt };
    }

    public validate(token: string): Promise<AccessTokenClaims> {
        // Verify signature + expiry; resolves with the claims or rejects.
        return this.signer.verify(token);
    }
}
