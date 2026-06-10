import { expect } from 'chai';
import { InMemoryClientRepository } from '../../src/repository/inMemoryClientRepository.js';
import type { NewClient } from '../../src/repository/types.js';

describe('InMemoryClientRepository', () => {
    let repository: InMemoryClientRepository;

    const sample: NewClient = {
        clientId: 'client-1',
        provider: 'google',
        providerSubject: 'google-123',
        email: 'user@example.com',
    };

    beforeEach(() => {
        repository = new InMemoryClientRepository();
    });

    it('creates a client and finds it by provider identity', async () => {
        const created = await repository.create(sample);

        expect(created.clientId).to.equal('client-1');
        expect(created.createdAt).to.be.instanceOf(Date);
        expect(created.lastLoginAt).to.equal(undefined);

        const found = await repository.findByProvider('google', 'google-123');
        expect(found?.clientId).to.equal('client-1');
        expect(found?.email).to.equal('user@example.com');
    });

    it('finds a client by its clientId', async () => {
        await repository.create(sample);

        const found = await repository.findById('client-1');
        expect(found?.providerSubject).to.equal('google-123');
    });

    it('returns undefined for an unknown identity or id', async () => {
        expect(await repository.findByProvider('google', 'nope')).to.equal(undefined);
        expect(await repository.findById('nope')).to.equal(undefined);
    });

    it('rejects a duplicate (provider, subject)', async () => {
        await repository.create(sample);

        let threw = false;
        try {
            await repository.create({
                clientId: 'client-2',
                provider: 'google',
                providerSubject: 'google-123',
            });
        } catch {
            threw = true;
        }

        expect(threw).to.equal(true);
    });

    it('rejects a duplicate clientId', async () => {
        await repository.create(sample);

        let threw = false;
        try {
            await repository.create({
                clientId: 'client-1',
                provider: 'github',
                providerSubject: 'github-9',
            });
        } catch {
            threw = true;
        }

        expect(threw).to.equal(true);
    });

    it('treats the same subject under different providers as different clients', async () => {
        await repository.create(sample);

        const other = await repository.create({
            clientId: 'client-2',
            provider: 'github',
            providerSubject: 'google-123',
        });

        expect(other.clientId).to.equal('client-2');
        expect((await repository.findByProvider('github', 'google-123'))?.clientId).to.equal(
            'client-2',
        );
        expect((await repository.findByProvider('google', 'google-123'))?.clientId).to.equal(
            'client-1',
        );
    });

    it('sets lastLoginAt on touchLastLogin', async () => {
        await repository.create(sample);
        expect((await repository.findById('client-1'))?.lastLoginAt).to.equal(undefined);

        await repository.touchLastLogin('client-1');
        expect((await repository.findById('client-1'))?.lastLoginAt).to.be.instanceOf(Date);
    });

    it('touchLastLogin is a no-op for an unknown client', async () => {
        await repository.touchLastLogin('nope');
        expect(await repository.findById('nope')).to.equal(undefined);
    });

    it('does not let callers mutate stored state by reference', async () => {
        const created = await repository.create(sample);
        created.email = 'tampered@example.com';

        const found = await repository.findById('client-1');
        expect(found?.email).to.equal('user@example.com');
    });
});
