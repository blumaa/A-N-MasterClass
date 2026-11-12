import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { memberSubscriptions } from './memberSubscriptions';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

async function subscribe(offerId: string, email: string, spaceId = 's1') {
  const sub = await repo.createSubscription({
    spaceId,
    offerId,
    email,
    kind: 'subscription',
    provider: 'fake',
    providerSubscriptionId: `FAKE-${offerId}-${email}`,
    amountCents: 1500,
    currency: 'EUR',
    billingInterval: 'month',
    trialDays: null,
    installments: null,
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: NOW,
    marketingConsent: false,
  });
  return repo.updateSubscription(sub.id, { status: 'active', profileId: email === 'me@test.com' ? 'me' : 'other' });
}

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
  const offer = await repo.createOffer({
    spaceId: 's1',
    slug: 'monthly',
    title: 'Monthly',
    priceCents: 1500,
    currency: 'EUR',
  });
  await repo.updateOffer(offer.id, { kind: 'subscription', billingInterval: 'month' });
  await subscribe(offer.id, 'me@test.com');
  await subscribe(offer.id, 'other@test.com');
  await subscribe('gone', 'me@test.com');
});

describe('memberSubscriptions', () => {
  it("lists only the member's subscriptions; an offer they cannot read shows a plain title", async () => {
    const rows = await memberSubscriptions(repo, 's1', 'me');
    expect(rows.map((r) => r.offerTitle).toSorted()).toEqual(['Monthly', 'Subscription']);
    expect(rows.every((r) => r.email === 'me@test.com')).toBe(true);
  });
});
