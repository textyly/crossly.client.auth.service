import type { IOidcProvider, OidcIdentity } from '../../src/oidc/types.js';

/**
 * Test double for {@link IOidcProvider}. `authorizeUrl` returns a fake provider
 * URL that echoes the `state` (so tests can read it back from the redirect), and
 * `exchangeCode` returns a preset identity — letting the login/callback flow be
 * driven end-to-end with no live provider.
 */
export class FakeOidcProvider implements IOidcProvider {
    public lastState?: string;
    public lastCodeVerifier?: string;

    public constructor(private identity: OidcIdentity) {}

    /** Change the identity the next `exchangeCode` returns. */
    public setIdentity(identity: OidcIdentity): void {
        this.identity = identity;
    }

    public async authorizeUrl(state: string, codeVerifier: string): Promise<string> {
        this.lastState = state;
        this.lastCodeVerifier = codeVerifier;
        return `https://fake-idp.test/authorize?state=${encodeURIComponent(state)}`;
    }

    public async exchangeCode(
        _callbackParams: URLSearchParams,
        _codeVerifier: string,
    ): Promise<OidcIdentity> {
        return this.identity;
    }
}
