/**
 * The identity an OIDC provider asserts after a successful login.
 *
 * `(provider, subject)` is the client identity key — `subject` is the provider's
 * stable user id (their `sub`), which is the same across all of that user's
 * devices. `email` is provider-reported and kept for display/contact only; it is
 * NEVER used to match or link clients.
 */
export interface OidcIdentity {
    /** Stable provider name, e.g. 'google'. Part of the client identity key. */
    provider: string;
    /** The provider's stable subject id for this user (their `sub`). */
    subject: string;
    /** Provider-reported email — display/contact only, never a matching key. */
    email?: string;
}

/**
 * Boundary to an OIDC identity provider (Google now; GitHub / Facebook / a broker
 * like Auth0 later). Implementations own the provider-specific OAuth/OIDC
 * mechanics; the rest of the service depends only on this interface, so adding a
 * provider is a single new class with no changes elsewhere.
 */
export interface IOidcProvider {
    /**
     * Build the provider's authorization URL to redirect the user to
     * (Authorization Code flow + PKCE). `state` and `codeVerifier` are generated
     * by the caller and stashed for the callback.
     */
    authorizeUrl(state: string, codeVerifier: string): Promise<string>;

    /**
     * Exchange the authorization `code` from the callback (validated against the
     * stashed `codeVerifier`) for the verified {@link OidcIdentity}.
     */
    exchangeCode(code: string, codeVerifier: string): Promise<OidcIdentity>;
}
