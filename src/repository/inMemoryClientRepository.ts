import type { ClientRecord, IClientRepository, NewClient } from './types.js';

/**
 * In-memory implementation of {@link IClientRepository}.
 *
 * State lives in two Maps (by clientId, and a (provider, subject) -> clientId
 * index) and is lost on restart. Used by the unit tests and for running locally
 * without a database; {@link PgClientRepository} is the durable implementation
 * wired into the service at runtime. Records are cloned on the way in and out so
 * callers cannot mutate stored state by reference.
 */
export class InMemoryClientRepository implements IClientRepository {
    private readonly byClientId: Map<string, ClientRecord> = new Map();
    private readonly byIdentity: Map<string, string> = new Map();

    public async findByProvider(
        provider: string,
        providerSubject: string,
    ): Promise<ClientRecord | undefined> {
        const clientId = this.byIdentity.get(this.identityKey(provider, providerSubject));
        if (!clientId) {
            return undefined;
        }

        const found = this.byClientId.get(clientId);
        return found ? { ...found } : undefined;
    }

    public async findById(clientId: string): Promise<ClientRecord | undefined> {
        const found = this.byClientId.get(clientId);
        return found ? { ...found } : undefined;
    }

    public async create(client: NewClient): Promise<ClientRecord> {
        const idKey = this.identityKey(client.provider, client.providerSubject);

        if (this.byClientId.has(client.clientId)) {
            throw new Error(`client already exists: ${client.clientId}`);
        }
        if (this.byIdentity.has(idKey)) {
            throw new Error(`identity already mapped: ${client.provider}/${client.providerSubject}`);
        }

        const record: ClientRecord = {
            clientId: client.clientId,
            provider: client.provider,
            providerSubject: client.providerSubject,
            email: client.email,
            createdAt: new Date(),
            lastLoginAt: undefined,
        };

        this.byClientId.set(record.clientId, record);
        this.byIdentity.set(idKey, record.clientId);
        return { ...record };
    }

    public async touchLastLogin(clientId: string): Promise<void> {
        const existing = this.byClientId.get(clientId);
        if (!existing) {
            return;
        }

        existing.lastLoginAt = new Date();
    }

    // A unique key for a (provider, subject) pair. The pair is JSON-encoded so no
    // combination of provider/subject characters can produce a colliding key.
    private identityKey(provider: string, providerSubject: string): string {
        return JSON.stringify([provider, providerSubject]);
    }
}
