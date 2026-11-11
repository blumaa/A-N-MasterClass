import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { createFakeProvider } from '@/lib/payments/fake';
import type { ProviderChoice } from '@/lib/payments/forSpace';
import type { PaymentProvider } from '@/lib/payments/provider';
import { receiveWebhook } from './webhook';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
});

const ready = (provider: PaymentProvider): (() => Promise<ProviderChoice>) => async () => ({ kind: 'ready', provider, livemode: false, clientId: 'cid' });

function provider(verified: boolean): PaymentProvider {
  return { ...createFakeProvider(), verifyWebhook: vi.fn().mockResolvedValue(verified), parseEvent: vi.fn().mockReturnValue({ kind: 'ignored' }) };
}

const call = (slug: string, resolve: () => Promise<ProviderChoice>) =>
  receiveWebhook(repo, (spaceId) => (spaceId === 's1' ? resolve() : Promise.reject(new Error('wrong space'))), slug, new Headers(), '{"id":"e1"}', NOW);

describe('receiveWebhook', () => {
  it('404 for an unknown space or a space without payments', async () => {
    expect(await call('nope', ready(provider(true)))).toBe(404);
    expect(await call('alexander', async () => ({ kind: 'not_set_up' }))).toBe(404);
  });

  it('401 when the signature does not verify, and the event is never parsed', async () => {
    const p = provider(false);
    expect(await call('alexander', ready(p))).toBe(401);
    expect(p.parseEvent).not.toHaveBeenCalled();
  });

  it('verifies against the raw body, then applies the event and answers 200', async () => {
    const p = provider(true);
    expect(await call('alexander', ready(p))).toBe(200);
    expect(p.verifyWebhook).toHaveBeenCalledWith(expect.any(Headers), '{"id":"e1"}');
    expect(p.parseEvent).toHaveBeenCalledWith('{"id":"e1"}');
  });
});
