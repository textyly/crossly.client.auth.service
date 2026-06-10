import pg from 'pg';
import { createApp } from './createApp.js';
import { JwtSigner } from './signer/jwtSigner.js';
import { PgClientRepository } from './repository/pgClientRepository.js';
import { databaseUrl, runMigrations } from './db/migrate.js';
import { loadConfig, loadGoogleConfig } from './config.js';
import { GoogleProvider } from './oidc/googleProvider.js';
import { NotConfiguredOidcProvider } from './oidc/notConfiguredOidcProvider.js';
import type { IOidcProvider } from './oidc/types.js';

const port = 5001;
// HS256 shared secret. MUST be overridden via AUTH_JWT_SECRET in any real environment.
const secret = process.env.AUTH_JWT_SECRET ?? 'dev-only-insecure-secret-change-me';

/** Build the real Google provider if configured, else a disabled placeholder. */
async function buildOidcProvider(): Promise<IOidcProvider> {
    const google = loadGoogleConfig();
    if (google.clientId && google.clientSecret) {
        return GoogleProvider.create({
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            redirectUri: google.callbackUrl,
        });
    }

    console.warn(
        'Google OIDC not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) — /auth/login is disabled',
    );
    return new NotConfiguredOidcProvider();
}

/**
 * Entry point: apply database migrations, then build the app via the shared
 * factory and listen.
 *
 * Migrations run on startup and are safe across several instances booting in
 * parallel (an advisory lock serializes them — see db/migrate.ts), so no separate
 * migration job is required. The service will not start serving until the schema
 * is up to date, which means a reachable Postgres is now required to boot.
 */
async function main(): Promise<void> {
    await runMigrations();

    // One pool for the app's lifetime, backing the client repository.
    const pool = new pg.Pool({ connectionString: databaseUrl() });
    const signer = new JwtSigner(secret);
    const clients = new PgClientRepository(pool);
    const oidc = await buildOidcProvider();
    const config = loadConfig();
    const app = createApp({ signer, clients, oidc, config });

    app.listen(port, () => {
        console.log(`crossly.client.auth.service listening on port ${port}`);
    });
}

main().catch((error) => {
    console.error('failed to start crossly.client.auth.service:', error);
    process.exit(1);
});
