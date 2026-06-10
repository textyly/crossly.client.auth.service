import { expect } from 'chai';
import request from 'supertest';
import type { MeResponse, SessionSummary } from '@textyly/crossly-client-auth-contracts';
import { createApp } from '../../src/createApp.js';
import { JwtSigner } from '../../src/signer/jwtSigner.js';
import { InMemoryClientRepository } from '../../src/repository/inMemoryClientRepository.js';
import { NotConfiguredOidcProvider } from '../../src/oidc/notConfiguredOidcProvider.js';
import { FakeOidcProvider } from './fakeOidcProvider.js';
import type { AuthConfig } from '../../src/config.js';

// Integration tests drive the full HTTP stack (controller -> manager -> signer/repo)
// through supertest, using an in-memory repo + a fake OIDC provider so no database
// or live Google is required. `request.agent(app)` persists cookies between
// requests, which is how we exercise the httpOnly session/OAuth cookies end-to-end.
describe('auth API (integration, cookie model)', () => {
    const signer = new JwtSigner('test-secret');
    const config: AuthConfig = {
        cookieSecret: 'test-cookie-secret',
        uiRedirectUrl: 'http://localhost:5000',
        corsOrigin: 'http://localhost:5000',
        secureCookies: false,
    };

    type Agent = ReturnType<typeof request.agent>;

    let clients: InMemoryClientRepository;
    let oidc: FakeOidcProvider;
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        clients = new InMemoryClientRepository();
        oidc = new FakeOidcProvider({
            provider: 'google',
            subject: 'google-test',
            email: 'test@example.com',
        });
        app = createApp({ signer, clients, oidc, config });
    });

    // Run the OAuth dance on an agent: /login -> read state from the redirect -> /callback.
    async function login(agent: Agent): Promise<request.Response> {
        const start = await agent.get('/auth/login');
        const state = new URL(start.headers.location).searchParams.get('state') ?? '';
        return agent.get(`/auth/callback?code=fake-code&state=${encodeURIComponent(state)}`);
    }

    function sessionCookie(res: request.Response): string | undefined {
        const set = res.headers['set-cookie'] as unknown as string[] | undefined;
        return set?.find((cookie) => cookie.startsWith('crossly_session='));
    }

    it('GET /health returns ok', async () => {
        const response = await request(app).get('/health');
        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ status: 'ok' });
    });

    it('POST /auth/guest sets an httpOnly session cookie and returns a guest summary', async () => {
        const agent = request.agent(app);
        const response = await agent.post('/auth/guest');

        expect(response.status).to.equal(201);
        const body = response.body as SessionSummary;
        expect(body.clientId).to.be.a('string').with.length.greaterThan(0);
        expect(body.guest).to.equal(true);

        const cookie = sessionCookie(response);
        expect(cookie, 'session cookie set').to.be.a('string');
        expect(cookie).to.contain('HttpOnly');

        // The cookie is a valid session: /validate accepts it and reports the same id.
        const validated = await agent.get('/auth/validate');
        expect(validated.status).to.equal(200);
        expect(validated.headers['x-client-id']).to.equal(body.clientId);
        expect(validated.headers['x-guest']).to.equal('true');
    });

    it('issues a different clientId for each guest', async () => {
        const first = await request.agent(app).post('/auth/guest');
        const second = await request.agent(app).post('/auth/guest');
        expect(first.body.clientId).to.not.equal(second.body.clientId);
    });

    it('POST /auth/refresh rolls the session cookie forward, keeping the clientId', async () => {
        const agent = request.agent(app);
        const guest = await agent.post('/auth/guest');

        const refreshed = await agent.post('/auth/refresh');
        expect(refreshed.status).to.equal(200);
        const body = refreshed.body as SessionSummary;
        expect(body.clientId).to.equal(guest.body.clientId);
        expect(body.guest).to.equal(true);
        expect(sessionCookie(refreshed)).to.be.a('string');
    });

    it('rejects refresh / validate / me with no session cookie (401)', async () => {
        expect((await request(app).post('/auth/refresh')).status).to.equal(401);
        expect((await request(app).get('/auth/validate')).status).to.equal(401);
        expect((await request(app).get('/auth/me')).status).to.equal(401);
    });

    it('GET /auth/login redirects to the provider with state and sets the oauth cookie', async () => {
        const response = await request(app).get('/auth/login');

        expect(response.status).to.equal(302);
        const location = new URL(response.headers.location);
        expect(location.host).to.equal('fake-idp.test');
        expect(location.searchParams.get('state')).to.be.a('string').with.length.greaterThan(0);

        const set = response.headers['set-cookie'] as unknown as string[] | undefined;
        expect(set?.some((cookie) => cookie.startsWith('crossly_oauth='))).to.equal(true);
    });

    it('GET /auth/callback completes login, sets an authenticated session, and /me reflects it', async () => {
        const agent = request.agent(app);
        const callback = await login(agent);

        expect(callback.status).to.equal(302);
        expect(callback.headers.location).to.equal(config.uiRedirectUrl);

        const me = (await agent.get('/auth/me')).body as MeResponse;
        expect(me.guest).to.equal(false);
        expect(me.clientId).to.be.a('string').with.length.greaterThan(0);
        expect(me.email).to.equal('test@example.com');
    });

    it('rejects a callback whose state does not match the cookie (CSRF) with 400', async () => {
        const agent = request.agent(app);
        await agent.get('/auth/login'); // sets the oauth cookie with the real state

        const response = await agent.get('/auth/callback?code=fake-code&state=tampered');
        expect(response.status).to.equal(400);
    });

    it('rejects a callback with no oauth cookie (400)', async () => {
        const response = await request(app).get('/auth/callback?code=fake-code&state=whatever');
        expect(response.status).to.equal(400);
    });

    it('promotes the guest in place: after login /me keeps the guest clientId', async () => {
        const agent = request.agent(app);
        const guest = await agent.post('/auth/guest');
        const guestClientId = (guest.body as SessionSummary).clientId;

        await login(agent);

        const me = (await agent.get('/auth/me')).body as MeResponse;
        expect(me.clientId).to.equal(guestClientId);
        expect(me.guest).to.equal(false);
    });

    it('a returning login on a different device resolves to the same client', async () => {
        // Device A: guest -> login (promotes), capture the account id.
        const deviceA = request.agent(app);
        await deviceA.post('/auth/guest');
        await login(deviceA);
        const idA = ((await deviceA.get('/auth/me')).body as MeResponse).clientId;

        // Device B: fresh agent, no guest -> login with the same identity.
        const deviceB = request.agent(app);
        await login(deviceB);
        const idB = ((await deviceB.get('/auth/me')).body as MeResponse).clientId;

        expect(idB).to.equal(idA);
    });

    it('POST /auth/logout clears the session; /me then returns 401', async () => {
        const agent = request.agent(app);
        await agent.post('/auth/guest');

        const loggedOut = await agent.post('/auth/logout');
        expect(loggedOut.status).to.equal(204);

        expect((await agent.get('/auth/me')).status).to.equal(401);
    });

    it('GET /auth/login returns 503 when no provider is configured', async () => {
        const disabled = createApp({
            signer,
            clients: new InMemoryClientRepository(),
            oidc: new NotConfiguredOidcProvider(),
            config,
        });

        const response = await request(disabled).get('/auth/login');
        expect(response.status).to.equal(503);
    });
});
