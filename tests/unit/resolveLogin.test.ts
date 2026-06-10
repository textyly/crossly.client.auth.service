import { expect } from 'chai';
import { AuthManager } from '../../src/managers/authManager.js';
import { JwtSigner } from '../../src/signer/jwtSigner.js';
import { InMemoryClientRepository } from '../../src/repository/inMemoryClientRepository.js';
import type { OidcIdentity } from '../../src/oidc/types.js';

describe('AuthManager.resolveLogin', () => {
    const signer = new JwtSigner('test-secret');
    let clients: InMemoryClientRepository;
    let manager: AuthManager;

    const googleAlice: OidcIdentity = {
        provider: 'google',
        subject: 'google-alice',
        email: 'alice@example.com',
    };

    beforeEach(() => {
        clients = new InMemoryClientRepository();
        manager = new AuthManager(signer, clients);
    });

    it('creates a brand-new client when there is no guest and no existing identity', async () => {
        const result = await manager.resolveLogin(googleAlice);

        expect(result.created).to.equal(true);
        expect(result.promoted).to.equal(false);
        expect(result.clientId).to.be.a('string').with.length.greaterThan(0);

        const stored = await clients.findByProvider('google', 'google-alice');
        expect(stored?.clientId).to.equal(result.clientId);
        expect(stored?.email).to.equal('alice@example.com');
    });

    it('promotes the guest in place — the account adopts the guest clientId', async () => {
        const guestId = 'guest-123';

        const result = await manager.resolveLogin(googleAlice, guestId);

        expect(result.promoted).to.equal(true);
        expect(result.created).to.equal(true);
        expect(result.clientId).to.equal(guestId);

        const stored = await clients.findByProvider('google', 'google-alice');
        expect(stored?.clientId).to.equal(guestId);
    });

    it('returns the existing client on a returning login (no new row, no promotion)', async () => {
        const first = await manager.resolveLogin(googleAlice, 'guest-abc'); // promote
        const second = await manager.resolveLogin(googleAlice, 'guest-xyz'); // returning, fresh guest

        expect(second.clientId).to.equal(first.clientId); // same account, not the new guest id
        expect(second.created).to.equal(false);
        expect(second.promoted).to.equal(false);
    });

    it('updates last_login on a returning login', async () => {
        const { clientId } = await manager.resolveLogin(googleAlice);
        expect((await clients.findById(clientId))?.lastLoginAt).to.equal(undefined);

        await manager.resolveLogin(googleAlice);
        expect((await clients.findById(clientId))?.lastLoginAt).to.be.instanceOf(Date);
    });

    it('treats a different provider with the same subject as a different client', async () => {
        const google = await manager.resolveLogin({ provider: 'google', subject: 'shared-sub' });
        const github = await manager.resolveLogin({ provider: 'github', subject: 'shared-sub' });

        expect(github.clientId).to.not.equal(google.clientId);
    });

    it('never matches on email (same email, different identity → different client)', async () => {
        const a = await manager.resolveLogin({
            provider: 'google',
            subject: 's1',
            email: 'same@example.com',
        });
        const b = await manager.resolveLogin({
            provider: 'github',
            subject: 's2',
            email: 'same@example.com',
        });

        expect(b.clientId).to.not.equal(a.clientId);
    });
});
