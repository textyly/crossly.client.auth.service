import * as oidc from 'openid-client';
import type { IOidcProvider, OidcIdentity } from './types.js';

export interface GoogleProviderOptions {
    clientId: string;
    clientSecret: string;
    /** Must exactly match an Authorized redirect URI on the Google OAuth client. */
    redirectUri: string;
}

const GOOGLE_ISSUER = new URL('https://accounts.google.com');
const SCOPE = 'openid email profile';

/**
 * {@link IOidcProvider} backed by Google via `openid-client` (Authorization Code
 * + PKCE). Created with {@link GoogleProvider.create}, which performs OIDC
 * discovery once against Google's well-known configuration.
 *
 * State/CSRF is handled by the controller (it owns the cookie), so the code
 * exchange here skips openid-client's own state check.
 */
export class GoogleProvider implements IOidcProvider {
    private constructor(
        private readonly config: oidc.Configuration,
        private readonly redirectUri: string,
    ) {}

    public static async create(options: GoogleProviderOptions): Promise<GoogleProvider> {
        const config = await oidc.discovery(GOOGLE_ISSUER, options.clientId, options.clientSecret);
        return new GoogleProvider(config, options.redirectUri);
    }

    public async authorizeUrl(state: string, codeVerifier: string): Promise<string> {
        const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
        const url = oidc.buildAuthorizationUrl(this.config, {
            redirect_uri: this.redirectUri,
            scope: SCOPE,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state,
        });
        return url.href;
    }

    public async exchangeCode(code: string, codeVerifier: string): Promise<OidcIdentity> {
        const currentUrl = new URL(this.redirectUri);
        currentUrl.searchParams.set('code', code);

        const tokens = await oidc.authorizationCodeGrant(this.config, currentUrl, {
            pkceCodeVerifier: codeVerifier,
            // The controller already validated `state` against its cookie.
            expectedState: oidc.skipStateCheck,
        });

        const claims = tokens.claims();
        if (!claims?.sub) {
            throw new Error('google login did not return a subject');
        }

        return {
            provider: 'google',
            subject: claims.sub,
            email: typeof claims.email === 'string' ? claims.email : undefined,
        };
    }
}
