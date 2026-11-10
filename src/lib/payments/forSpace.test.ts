import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { createFakeProvider } from './fake';
import { providerForSpace } from './forSpace';

let repo: FakeRepo;
const NOW = new Date('2026-11-10T00:00:00Z');

beforeEach(() => {
  repo = createFakeRepo(emptyDb());
});

const save = (env: 'sandbox' | 'live', secret: string | null) =>
  repo.savePaymentCredentials({ spaceId: 's1', env, clientId: `cid-${env}`, webhookId: 'WH', updatedAt: NOW }, secret);

describe('providerForSpace', () => {
  it('uses PayPal with the env credentials; livemode only for live', async () => {
    await save('sandbox', 'sec');
    await save('live', 'sec');
    const sandbox = await providerForSpace(repo, 's1', { env: 'sandbox', fake: null });
    expect(sandbox).toMatchObject({ kind: 'ready', livemode: false, clientId: 'cid-sandbox' });
    if (sandbox.kind === 'ready') expect(sandbox.provider.name).toBe('paypal');
    expect(await providerForSpace(repo, 's1', { env: 'live', fake: null })).toMatchObject({ livemode: true, clientId: 'cid-live' });
  });

  it('falls back to the fake provider only when allowed', async () => {
    const fake = createFakeProvider();
    expect(await providerForSpace(repo, 's1', { env: 'sandbox', fake })).toMatchObject({ kind: 'ready', livemode: false, clientId: null });
    expect(await providerForSpace(repo, 's1', { env: 'sandbox', fake: null })).toEqual({ kind: 'not_set_up' });
  });

  it('is not set up without a secret', async () => {
    await save('sandbox', null);
    expect(await providerForSpace(repo, 's1', { env: 'sandbox', fake: null })).toEqual({ kind: 'not_set_up' });
  });
});
