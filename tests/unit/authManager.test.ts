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

    it('gives a different clientId on each call', async () => {
        const first = await manager.createGuestSession();
        const second = await manager.createGuestSession();

        expect(first.clientId).to.not.equal(second.clientId);
    });
});
