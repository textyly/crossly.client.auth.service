import { randomUUID } from 'node:crypto';
import type { GuestSessionResponse } from '@textyly/crossly-client-auth-contracts';
import type { IAuthManager } from './types.js';
import type { IJwtSigner } from '../signer/types.js';

/** Guest sessions are valid for 30 days so anonymous users do not lose work quickly. */
const GUEST_TOKEN_TTL_SECONDS: number = 60 * 60 * 24 * 30;

/**
 * Default {@link IAuthManager} implementation. Mints anonymous guest sessions:
 * it generates a new clientId and delegates token signing to the {@link IJwtSigner}.
 */
export class AuthManager implements IAuthManager {
    public constructor(private readonly signer: IJwtSigner) {}

    public async createGuestSession(): Promise<GuestSessionResponse> {
        const clientId = randomUUID();
        const { token, expiresAt } = await this.signer.sign(clientId, true, GUEST_TOKEN_TTL_SECONDS);

        return { token, clientId, expiresAt };
    }
}
