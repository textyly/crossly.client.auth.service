/**
 * Service configuration, read from the environment with dev-friendly defaults.
 * Secrets/URLs come from env (k8s Secret/ConfigMap later); the defaults make
 * local dev work with zero setup (except Google login, which needs real creds).
 */

/** httpOnly cookie holding the session JWT (guest or authenticated). */
export const SESSION_COOKIE = 'crossly_session';

/** Short-lived signed cookie holding the OAuth `state` + PKCE `codeVerifier`. */
export const OAUTH_COOKIE = 'crossly_oauth';

/** Runtime config for cookies, CORS and post-login redirects. */
export interface AuthConfig {
    /** Secret used to sign the short-lived OAuth cookie. */
    cookieSecret: string;
    /** Where the browser is sent after a successful login / after logout. */
    uiRedirectUrl: string;
    /** Allowed browser origin for credentialed CORS requests. */
    corsOrigin: string;
    /** Whether cookies carry the `Secure` attribute (true behind HTTPS). */
    secureCookies: boolean;
}

/** Google OAuth client config; clientId/secret absent ⇒ login is disabled. */
export interface GoogleConfig {
    clientId?: string;
    clientSecret?: string;
    callbackUrl: string;
}

export function loadConfig(): AuthConfig {
    const uiRedirectUrl = process.env.UI_URL ?? 'http://localhost:5000';
    return {
        cookieSecret: process.env.COOKIE_SECRET ?? 'dev-only-cookie-secret-change-me',
        uiRedirectUrl,
        corsOrigin: process.env.CORS_ORIGIN ?? uiRedirectUrl,
        secureCookies: (process.env.SECURE_COOKIES ?? 'false') === 'true',
    };
}

export function loadGoogleConfig(): GoogleConfig {
    return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:5001/auth/callback',
    };
}
