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

/**
 * Internal session shape produced by the signer/manager: the raw token + expiry.
 * In the BFF cookie model the token is set as an httpOnly cookie rather than
 * returned in the response body — see {@link SessionSummary} / {@link MeResponse}.
 */
export interface GuestSessionResponse {
    /** Signed JWT (set by the server as an httpOnly session cookie). */
    token: string;
    /** The client identifier (equals the token's `sub`). */
    clientId: string;
    /** Token expiry, in seconds since the epoch. */
    expiresAt: number;
}

/**
 * Minimal session summary returned by `POST /auth/guest`, `POST /auth/refresh`
 * and `GET /auth/validate`. The session token itself rides in an httpOnly cookie.
 */
export interface SessionSummary {
    /** The client identifier (equals the session token's `sub`). */
    clientId: string;
    /** True for anonymous guests; false for authenticated users. */
    guest: boolean;
}

/** Identity returned by `GET /auth/me` so the UI knows who it is (it can't read the cookie). */
export interface MeResponse {
    clientId: string;
    guest: boolean;
    /** Present for authenticated users when the provider reported one; display only. */
    email?: string;
}
