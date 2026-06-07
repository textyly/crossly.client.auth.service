/**
 * Shared contracts for the Crossly Client Auth service.
 *
 * These types describe the auth tokens and responses exchanged over the
 * service's API and are meant to be consumed by any TypeScript/JavaScript
 * client (e.g. crossly.ui) and by other services that validate tokens.
 * Keep this module free of runtime/server dependencies.
 */

/** Claims carried by a Crossly access token (guest now; authenticated later). */
export interface AccessTokenClaims {
    /** Subject — the stable client identifier. Equals the clientId used elsewhere. */
    sub: string;
    /** True for anonymous guest sessions; false for authenticated users. */
    guest: boolean;
    /** Issued-at, in seconds since the epoch. */
    iat: number;
    /** Expiry, in seconds since the epoch. */
    exp: number;
}

/** Response returned when a new anonymous guest session is created. */
export interface GuestSessionResponse {
    /** Signed JWT to send as `Authorization: Bearer <token>`. */
    token: string;
    /** The guest's client identifier (equals the token's `sub`). */
    clientId: string;
    /** Token expiry, in seconds since the epoch. */
    expiresAt: number;
}
