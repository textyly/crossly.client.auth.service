import type { IOidcProvider, OidcIdentity } from './types.js';

/**
 * Placeholder {@link IOidcProvider} used when no real provider is configured
 * (e.g. Google client id/secret absent in local dev). Guest sessions keep
 * working; any attempt to log in fails loudly so the controller can return 503.
 */
export class NotConfiguredOidcProvider implements IOidcProvider {
    public authorizeUrl(): Promise<string> {
        throw new Error('OIDC login is not configured');
    }

    public exchangeCode(): Promise<OidcIdentity> {
        throw new Error('OIDC login is not configured');
    }
}
