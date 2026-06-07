import type { GuestSessionResponse } from '@textyly/crossly-client-auth-contracts';

/**
 * Business operations for client authentication. Sits between the controllers
 * (HTTP) and the signer (token issuance).
 */
export interface IAuthManager {
    /** Create a fresh anonymous guest session (new clientId + signed token). */
    createGuestSession(): Promise<GuestSessionResponse>;
}
