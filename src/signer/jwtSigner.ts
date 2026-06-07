import { SignJWT, jwtVerify } from 'jose';
import type { AccessTokenClaims } from '@textyly/crossly-client-auth-contracts';
import type { IJwtSigner } from './types.js';

/**
 * HS256 JWT signer backed by `jose`.
 *
 * "Extremely simple" by design: a single shared secret both signs and verifies
 * tokens. When real identity providers are introduced, swap this for an
 * RS256/JWKS implementation of {@link IJwtSigner} — nothing else in the service
 * (or in consumers) changes, because the token shape stays the same.
 */
export class JwtSigner implements IJwtSigner {
    private static readonly algorithm: string = 'HS256';
    private readonly key: Uint8Array;

    public constructor(secret: string) {
        this.key = new TextEncoder().encode(secret);
    }

    public async sign(
        sub: string,
        guest: boolean,
        ttlSeconds: number,
    ): Promise<{ token: string; expiresAt: number }> {
        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + ttlSeconds;

        const token = await new SignJWT({ guest })
            .setProtectedHeader({ alg: JwtSigner.algorithm })
            .setSubject(sub)
            .setIssuedAt(issuedAt)
            .setExpirationTime(expiresAt)
            .sign(this.key);

        return { token, expiresAt };
    }

    public async verify(token: string): Promise<AccessTokenClaims> {
        const { payload } = await jwtVerify(token, this.key);

        return {
            sub: payload.sub as string,
            guest: payload.guest as boolean,
            iat: payload.iat as number,
            exp: payload.exp as number,
        };
    }
}
