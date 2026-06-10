/**
 * A persisted client (account).
 *
 * `clientId` equals the token `sub` and is immutable for the life of the client
 * (it is reused from the guest's id on promote-in-place). Identity is the pair
 * `(provider, providerSubject)` — the provider's stable subject is matched
 * directly; email is stored for display/contact only and is NEVER a matching key.
 *
 * Guests are NOT stored here — only clients that have logged in at least once.
 */
export interface ClientRecord {
    clientId: string;
    provider: string;
    providerSubject: string;
    email?: string;
    createdAt: Date;
    lastLoginAt?: Date;
}

/** Fields required to insert a new client. */
export interface NewClient {
    clientId: string;
    provider: string;
    providerSubject: string;
    email?: string;
}

/**
 * Persistence boundary for authenticated clients (accounts).
 *
 * Implementations may be Postgres ({@link PgClientRepository}) or in-memory
 * ({@link InMemoryClientRepository}); the rest of the service depends only on
 * this interface.
 */
export interface IClientRepository {
    /** Find a client by its external identity. Returns undefined if none exists. */
    findByProvider(provider: string, providerSubject: string): Promise<ClientRecord | undefined>;

    /** Find a client by its immutable clientId. Returns undefined if none exists. */
    findById(clientId: string): Promise<ClientRecord | undefined>;

    /**
     * Insert a new client. Rejects if `clientId` already exists or if
     * `(provider, providerSubject)` is already mapped to another client.
     */
    create(client: NewClient): Promise<ClientRecord>;

    /** Set last_login_at to now for the given client. No-op if the client is unknown. */
    touchLastLogin(clientId: string): Promise<void>;
}
