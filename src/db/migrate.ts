import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

/**
 * Forward-only migration runner, safe to run from several instances at once.
 *
 * Applies every `.sql` file in ./migrations (sorted by filename) that has not yet
 * been recorded in `schema_migrations`, each in its own transaction. A cluster-wide
 * Postgres advisory lock serializes migrators: the first caller applies the pending
 * files; any others block on the lock, then acquire it, see everything already
 * applied, and do nothing. The lock is session-scoped and held on a single dedicated
 * connection for the whole run, so it also auto-releases if the process crashes.
 *
 * Connection comes from DATABASE_URL; the default targets the local dev Postgres in
 * docker-compose.yml. Run standalone with `npm run migrate`, or it runs on service
 * startup (see app.ts).
 */
// Host port 5433 (see docker-compose.yml) so the dev container can coexist with a
// native Postgres that already owns 5432.
const DEFAULT_DATABASE_URL = 'postgres://crossly:crossly@127.0.0.1:5433/crossly_auth';
const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

// Constant key for the advisory lock that serializes migrations cluster-wide.
// Any fixed value works as long as it is unique to this concern.
const MIGRATION_LOCK_KEY = 4242420001;

export async function runMigrations(
    connectionString: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
): Promise<void> {
    const pool = new pg.Pool({ connectionString });
    try {
        await migrateWithPool(pool);
    } finally {
        await pool.end();
    }
}

async function migrateWithPool(pool: pg.Pool): Promise<void> {
    // Hold the advisory lock and run every migration on ONE connection so the
    // session-scoped lock spans the entire run.
    const client = await pool.connect();
    try {
        await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_KEY]);

        await client.query(
            `CREATE TABLE IF NOT EXISTS schema_migrations (
                name       TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
        );

        const files = readdirSync(MIGRATIONS_DIR)
            .filter((file) => file.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [
                file,
            ]);
            if ((applied.rowCount ?? 0) > 0) {
                console.log(`skip   ${file}`);
                continue;
            }

            const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`apply  ${file}`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }

        console.log('migrations complete');
    } finally {
        // Best-effort explicit unlock; releasing the connection also drops the
        // session lock, so a failure here is harmless.
        try {
            await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_KEY]);
        } catch {
            // ignore
        }
        client.release();
    }
}

// CLI entrypoint: only runs when invoked directly (`node dist/db/migrate.js`),
// not when imported by the app for startup migration.
const invokedDirectly =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
    runMigrations().catch((error) => {
        console.error('migration failed:', error);
        process.exit(1);
    });
}
