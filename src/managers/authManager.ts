import { randomUUID } from 'node:crypto';
import type {
    AccessTokenClaims,
    GuestSessionResponse,
    MeResponse,
} from '@textyly/crossly-client-auth-contracts';
import type { IAuthManager, ResolvedLogin } from './types.js';
import type { IJwtSigner } from '../signer/types.js';
import type { IClientRepository } from '../repository/types.js';
import type { OidcIdentity } from '../oidc/types.js';

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
 * - {@link resolveLogin} maps a verified provider identity to a stable clientId,
 *   promoting the current guest in place on first login.
 *
 * Token signing/verification is delegated to the injected {@link IJwtSigner};
 * account persistence to the injected {@link IClientRepository}.
 */
export class AuthManager implements IAuthManager {
    public constructor(
        private readonly signer: IJwtSigner,
        private readonly clients: IClientRepository,
    ) {}

    public async createGuestSession(): Promise<GuestSessionResponse> {
        const clientId = randomUUID();
        const { token, expiresAt } = await this.signer.sign(clientId, true, SESSION_TTL_SECONDS);

        return { token, clientId, expiresAt };
    }

    public async createAuthenticatedSession(clientId: string): Promise<GuestSessionResponse> {
        const { token, expiresAt } = await this.signer.sign(clientId, false, SESSION_TTL_SECONDS);
        return { token, clientId, expiresAt };
    }

    public async describeSession(token: string): Promise<MeResponse> {
        const claims = await this.signer.verify(token);
        if (claims.guest) {
            return { clientId: claims.sub, guest: true };
        }

        // Authenticated: surface the stored email (display only) if we have one.
        const client = await this.clients.findById(claims.sub);
        return { clientId: claims.sub, guest: false, email: client?.email };
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

    public async resolveLogin(
        identity: OidcIdentity,
        guestClientId?: string,
    ): Promise<ResolvedLogin> {
        const existing = await this.clients.findByProvider(identity.provider, identity.subject);
        if (existing) {
            // Returning user on this provider — recognized on any device. The
            // current guest id (if any) is discarded by the caller; this account's
            // id wins.
            await this.clients.touchLastLogin(existing.clientId);
            return { clientId: existing.clientId, created: false, promoted: false };
        }

        // New external identity. Promote the current guest in place if one is
        // present (the account adopts the guest's id, so the guest's data on this
        // device carries over with no migration); otherwise mint a fresh id.
        const promoted = guestClientId !== undefined;
        const clientId = guestClientId ?? randomUUID();

        await this.clients.create({
            clientId,
            provider: identity.provider,
            providerSubject: identity.subject,
            email: identity.email,
        });

        return { clientId, created: true, promoted };
    }
}
