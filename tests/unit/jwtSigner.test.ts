import { expect } from 'chai';
import { JwtSigner } from '../../src/signer/jwtSigner.js';

describe('JwtSigner', () => {
    const signer = new JwtSigner('test-secret');

    it('signs a token and verifies its claims', async () => {
        const { token, expiresAt } = await signer.sign('client-1', true, 3600);

        const claims = await signer.verify(token);

        expect(claims.sub).to.equal('client-1');
        expect(claims.guest).to.equal(true);
        expect(claims.exp).to.equal(expiresAt);
        expect(claims.iat).to.be.a('number');
    });

    it('rejects a token signed with a different secret', async () => {
        const { token } = await signer.sign('client-1', true, 3600);
        const other = new JwtSigner('different-secret');

        let threw = false;
        try {
            await other.verify(token);
        } catch {
            threw = true;
        }

        expect(threw).to.equal(true);
    });

    it('rejects a malformed token', async () => {
        let threw = false;
        try {
            await signer.verify('not-a-jwt');
        } catch {
            threw = true;
        }

        expect(threw).to.equal(true);
    });
});
