import type { AccessTokenClaims, GuestSessionResponse } from '@textyly/crossly-client-auth-contracts';
import type { OidcIdentity } from '../oidc/types.js';

/**
 * Outcome of resolving a verified provider identity to a stable client.
 */
export interface ResolvedLogin {
    /** The stable client id (== token `sub`) this login resolves to. */
    clientId: string;
    /** True if a new `clients` row was written (a brand-new account or a promotion). */
    created: boolean;
    /** True if an existing guest was promoted in place (its id became the account). */
    promoted: boolean;
}

/**
 * Business operations for client authentication. Sits between the controllers
 * (HTTP) and the signer (token issuance/verification) + client repository.
 */
export interface IAuthManager {
    /** Create a fresh anonymous guest session (new clientId + signed token). */
    createGuestSession(): Promise<GuestSessionResponse>;

    /**
     * Re-issue a token for the session identified by `token`, preserving its
     * identity (clientId) but resetting the expiry. Throws if the token is
     * invalid or expired.
     */
    refreshSession(token: string): Promise<GuestSessionResponse>;

    /**
     * Verify a token and return its claims. Throws if the token is invalid or
     * expired. Used by the gateway (ForwardAuth) to turn a token into a trusted
     * clientId.
     */
    validate(token: string): Promise<AccessTokenClaims>;

    /**
     * Resolve a verified provider identity to a stable clientId:
     * - existing `(provider, subject)` → that client (returning user, any device);
     * - else, a guest is present → **promote in place** (reuse `guestClientId`);
     * - else → create a brand-new client.
     */
    resolveLogin(identity: OidcIdentity, guestClientId?: string): Promise<ResolvedLogin>;
}
