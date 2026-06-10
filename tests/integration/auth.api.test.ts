import { expect } from 'chai';
import request from 'supertest';
import type { GuestSessionResponse } from '@textyly/crossly-client-auth-contracts';
import { createApp } from '../../src/createApp.js';
import { JwtSigner } from '../../src/signer/jwtSigner.js';
import { InMemoryClientRepository } from '../../src/repository/inMemoryClientRepository.js';

// Integration tests drive the full HTTP stack (controller -> manager -> signer)
// through supertest with a test secret, so no external dependency is required.
//
// Response bodies are typed with the public `contracts` package — the same types
// an external client (e.g. crossly.ui) consumes — so these tests exercise the
// published contract rather than internal types.
describe('auth API (integration)', () => {
    const signer = new JwtSigner('test-secret');
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        app = createApp({ signer, clients: new InMemoryClientRepository() });
    });

    it('GET /health returns ok', async () => {
        const response = await request(app).get('/health');

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ status: 'ok' });
    });

    it('POST /auth/guest issues a valid, verifiable guest session', async () => {
        const response = await request(app).post('/auth/guest');

        expect(response.status).to.equal(201);
        const body = response.body as GuestSessionResponse;
        expect(body.token).to.be.a('string').with.length.greaterThan(0);
        expect(body.clientId).to.be.a('string').with.length.greaterThan(0);

        const claims = await signer.verify(body.token);
        expect(claims.sub).to.equal(body.clientId);
        expect(claims.guest).to.equal(true);
    });

    it('issues a different clientId for each guest', async () => {
        const first = await request(app).post('/auth/guest');
        const second = await request(app).post('/auth/guest');

        expect(first.body.clientId).to.not.equal(second.body.clientId);
    });

    it('POST /auth/refresh rolls a session forward, keeping the same clientId', async () => {
        const guest = await request(app).post('/auth/guest');
        const { token, clientId } = guest.body as GuestSessionResponse;

        const response = await request(app).post('/auth/refresh').set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        const body = response.body as GuestSessionResponse;
        expect(body.clientId).to.equal(clientId);

        const claims = await signer.verify(body.token);
        expect(claims.sub).to.equal(clientId);
        expect(claims.guest).to.equal(true);
    });

    it('POST /auth/refresh without a token returns 401', async () => {
        const response = await request(app).post('/auth/refresh');

        expect(response.status).to.equal(401);
    });

    it('POST /auth/refresh with an invalid token returns 401', async () => {
        const response = await request(app).post('/auth/refresh').set('Authorization', 'Bearer not-a-jwt');

        expect(response.status).to.equal(401);
    });

    it('GET /auth/validate returns 200 and the identity headers for a valid token', async () => {
        const guest = await request(app).post('/auth/guest');
        const { token, clientId } = guest.body as GuestSessionResponse;

        const response = await request(app).get('/auth/validate').set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.headers['x-client-id']).to.equal(clientId);
        expect(response.headers['x-guest']).to.equal('true');
    });

    it('GET /auth/validate without a token returns 401', async () => {
        const response = await request(app).get('/auth/validate');

        expect(response.status).to.equal(401);
    });

    it('GET /auth/validate with an invalid token returns 401', async () => {
        const response = await request(app).get('/auth/validate').set('Authorization', 'Bearer not-a-jwt');

        expect(response.status).to.equal(401);
    });
});
