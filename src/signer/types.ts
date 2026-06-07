import type { AccessTokenClaims } from '@textyly/crossly-client-auth-contracts';

/**
 * Token signing/verification boundary — the lowest layer of the service
 * (the auth analogue of a repository). Implementations wrap a concrete JWT
 * library + key; the rest of the service depends only on this interface.
 */
export interface IJwtSigner {
    /** Sign an access token for `sub`, valid for `ttlSeconds`. Returns the token and its expiry. */
    sign(sub: string, guest: boolean, ttlSeconds: number): Promise<{ token: string; expiresAt: number }>;

    /** Verify a token and return its claims, or throw if it is invalid or expired. */
    verify(token: string): Promise<AccessTokenClaims>;
}
