import { createApp } from './createApp.js';
import { JwtSigner } from './signer/jwtSigner.js';
import { runMigrations } from './db/migrate.js';

const port = 5001;
// HS256 shared secret. MUST be overridden via AUTH_JWT_SECRET in any real environment.
const secret = process.env.AUTH_JWT_SECRET ?? 'dev-only-insecure-secret-change-me';

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

    const signer = new JwtSigner(secret);
    const app = createApp(signer);

    app.listen(port, () => {
        console.log(`crossly.client.auth.service listening on port ${port}`);
    });
}

main().catch((error) => {
    console.error('failed to start crossly.client.auth.service:', error);
    process.exit(1);
});
