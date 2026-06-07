import type { AccessTokenClaims, GuestSessionResponse } from '@textyly/crossly-client-auth-contracts';

/**
 * Business operations for client authentication. Sits between the controllers
 * (HTTP) and the signer (token issuance/verification).
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
     * expired. Used by the gateway (ForwardAuth) to turn a Bearer token into a
     * trusted clientId.
     */
    validate(token: string): Promise<AccessTokenClaims>;
}
