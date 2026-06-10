import pg from 'pg';
import type { ClientRecord, IClientRepository, NewClient } from './types.js';

/** Raw row shape returned from the `clients` table. */
interface ClientRow {
    client_id: string;
    provider: string;
    provider_subject: string;
    email: string | null;
    created_at: Date;
    last_login_at: Date | null;
}

/**
 * PostgreSQL-backed implementation of {@link IClientRepository}.
 *
 * A connected {@link pg.Pool} is injected; its lifecycle (and the schema, via the
 * migration runner) is owned by the composition root. The UNIQUE (provider,
 * provider_subject) constraint enforces one client per external identity at the
 * database level, so a concurrent duplicate `create` rejects rather than racing.
 */
export class PgClientRepository implements IClientRepository {
    public constructor(private readonly pool: pg.Pool) {}

    public async findByProvider(
        provider: string,
        providerSubject: string,
    ): Promise<ClientRecord | undefined> {
        const result = await this.pool.query<ClientRow>(
            'SELECT * FROM clients WHERE provider = $1 AND provider_subject = $2',
            [provider, providerSubject],
        );

        const row = result.rows[0];
        return row ? this.toDomain(row) : undefined;
    }

    public async findById(clientId: string): Promise<ClientRecord | undefined> {
        const result = await this.pool.query<ClientRow>(
            'SELECT * FROM clients WHERE client_id = $1',
            [clientId],
        );

        const row = result.rows[0];
        return row ? this.toDomain(row) : undefined;
    }

    public async create(client: NewClient): Promise<ClientRecord> {
        const result = await this.pool.query<ClientRow>(
            `INSERT INTO clients (client_id, provider, provider_subject, email)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [client.clientId, client.provider, client.providerSubject, client.email ?? null],
        );

        return this.toDomain(result.rows[0]);
    }

    public async touchLastLogin(clientId: string): Promise<void> {
        await this.pool.query('UPDATE clients SET last_login_at = now() WHERE client_id = $1', [
            clientId,
        ]);
    }

    private toDomain(row: ClientRow): ClientRecord {
        return {
            clientId: row.client_id,
            provider: row.provider,
            providerSubject: row.provider_subject,
            email: row.email ?? undefined,
            createdAt: row.created_at,
            lastLoginAt: row.last_login_at ?? undefined,
        };
    }
}
