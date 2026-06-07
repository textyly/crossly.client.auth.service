import { expect } from 'chai';
import { AuthManager } from '../../src/managers/authManager.js';
import { JwtSigner } from '../../src/signer/jwtSigner.js';

describe('AuthManager', () => {
    const signer = new JwtSigner('test-secret');
    let manager: AuthManager;

    beforeEach(() => {
        manager = new AuthManager(signer);
    });

    it('creates a guest session with a token, clientId and expiry', async () => {
        const session = await manager.createGuestSession();

        expect(session.token).to.be.a('string').with.length.greaterThan(0);
        expect(session.clientId).to.be.a('string').with.length.greaterThan(0);
        expect(session.expiresAt).to.be.a('number');
    });

    it('issues a token whose subject equals the clientId and is marked guest', async () => {
        const session = await manager.createGuestSession();

        const claims = await signer.verify(session.token);

        expect(claims.sub).to.equal(session.clientId);
        expect(claims.guest).to.equal(true);
    });

    it('issues a session valid for ~1 year', async () => {
        const before = Math.floor(Date.now() / 1000);
        const session = await manager.createGuestSession();

        const oneYear = 60 * 60 * 24 * 365;
        expect(session.expiresAt).to.be.closeTo(before + oneYear, 5);
    });

    it('gives a different clientId on each call', async () => {
        const first = await manager.createGuestSession();
        const second = await manager.createGuestSession();

        expect(first.clientId).to.not.equal(second.clientId);
    });

    it('refreshes a session, preserving the clientId and guest flag', async () => {
        const original = await manager.createGuestSession();

        const refreshed = await manager.refreshSession(original.token);

        expect(refreshed.clientId).to.equal(original.clientId);
        const claims = await signer.verify(refreshed.token);
        expect(claims.sub).to.equal(original.clientId);
        expect(claims.guest).to.equal(true);
    });

    it('rejects refreshing an invalid token', async () => {
        let threw = false;
        try {
            await manager.refreshSession('not-a-jwt');
        } catch {
            threw = true;
        }

        expect(threw).to.equal(true);
    });
});
