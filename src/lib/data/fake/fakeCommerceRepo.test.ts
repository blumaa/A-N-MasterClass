import { beforeEach, describe, expect, it } from 'vitest';
import type { NewOrder } from '../repo';
import type { Order } from '../types';
import { emptyDb } from './db';
import { createFakeRepo, type FakeRepo } from './fakeRepo';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push(
    { id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false },
    { id: 's2', slug: 'natasha', name: 'Natasha', status: 'live', locale: 'en', isTest: false },
  );
});

const offer = (spaceId = 's1', slug = 'full') =>
  repo.createOffer({ spaceId, slug, title: 'Full access', priceCents: 4900, currency: 'EUR' });

const order = (offerId: string, extra: Partial<NewOrder> = {}): Promise<Order> =>
  repo.createOrder({
    spaceId: 's1',
    offerId,
    email: 'buyer@test',
    provider: 'fake',
    providerOrderId: 'po-1',
    amountCents: 4900,
    currency: 'EUR',
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: NOW,
    marketingConsent: false,
    createdAt: NOW,
    ...extra,
  });

describe('profiles by email', () => {
  it('finds a profile case-insensitively and creates one when missing', async () => {
    const created = await repo.createProfile('Buyer@Test');
    expect(created.email).toBe('buyer@test');
    expect(await repo.profileByEmail('BUYER@test')).toEqual(created);
    await expect(repo.createProfile('buyer@test')).rejects.toThrow(/email/);
  });

  it('ensureSpaceProfile inserts once and keeps the existing name', async () => {
    await repo.ensureSpaceProfile({ spaceId: 's1', profileId: 'u1', displayName: 'Robin' });
    await repo.ensureSpaceProfile({ spaceId: 's1', profileId: 'u1', displayName: 'Other' });
    expect(await repo.spaceProfiles('s1')).toEqual([{ spaceId: 's1', profileId: 'u1', displayName: 'Robin' }]);
  });
});

describe('offers', () => {
  it('starts as draft, scopes by space and finds by slug', async () => {
    const o = await offer('s1');
    await offer('s2');
    expect(o.status).toBe('draft');
    expect(o.description).toBeNull();
    expect(await repo.offers('s1')).toHaveLength(1);
    expect(await repo.offerBySlug('s1', 'full')).toEqual(o);
    expect(await repo.offerBySlug('s2', 'nope')).toBeNull();
  });

  it('refuses a duplicate or invalid slug and a negative or huge price', async () => {
    await offer('s1');
    await expect(offer('s1')).rejects.toThrow(/slug/);
    await expect(offer('s1', 'Bad Slug')).rejects.toThrow(/slug/);
    const o = await offer('s1', 'other');
    await expect(repo.updateOffer(o.id, { priceCents: -1 })).rejects.toThrow(/price/);
    await expect(repo.updateOffer(o.id, { priceCents: 10_000_000 })).rejects.toThrow(/price/);
    await expect(repo.updateOffer(o.id, { slug: 'full' })).rejects.toThrow(/slug/);
  });

  it('replaces linked products, only products of the same space', async () => {
    const o = await offer();
    const p1 = await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'a', title: 'A' });
    const p2 = await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'b', title: 'B' });
    const foreign = await repo.createProduct({ spaceId: 's2', kind: 'program', slug: 'c', title: 'C' });
    await repo.setOfferItems(o.id, [p1, p2].map((p) => ({ productId: p.id, accessGroupId: null })));
    await repo.setOfferItems(o.id, [{ productId: p2.id, accessGroupId: null }]);
    expect(await repo.offerItems(o.id)).toEqual([{ productId: p2.id, accessGroupId: null }]);
    await expect(repo.setOfferItems(o.id, [{ productId: foreign.id, accessGroupId: null }])).rejects.toThrow(/space/);
  });

  it('links a community with one of its own access groups only', async () => {
    const o = await offer();
    const circle = await repo.createProduct({ spaceId: 's1', kind: 'community', slug: 'circle', title: 'Circle' });
    const other = await repo.createProduct({ spaceId: 's1', kind: 'community', slug: 'other', title: 'Other' });
    const vip = await repo.createAccessGroup({ communityId: circle.id, title: 'VIP' });
    const [otherDefault] = await repo.accessGroups(other.id);
    await repo.setOfferItems(o.id, [{ productId: circle.id, accessGroupId: vip.id }]);
    expect(await repo.offerItems(o.id)).toEqual([{ productId: circle.id, accessGroupId: vip.id }]);
    await expect(repo.setOfferItems(o.id, [{ productId: circle.id, accessGroupId: otherDefault!.id }])).rejects.toThrow(/group/);
    await expect(repo.deleteAccessGroup(vip.id)).rejects.toThrow(/in use/);
  });

  it('deletes an offer without orders, refuses one with orders', async () => {
    const free = await offer('s1', 'free');
    await repo.deleteOffer(free.id);
    expect(await repo.offer(free.id)).toBeNull();
    const sold = await offer('s1', 'sold');
    await order(sold.id);
    await expect(repo.deleteOffer(sold.id)).rejects.toThrow(/orders/);
  });
});

describe('orders', () => {
  it('starts created, lowercases email and looks up by provider ids', async () => {
    const o = await offer();
    const row = await order(o.id, { email: 'Buyer@Test' });
    expect(row).toMatchObject({ status: 'created', email: 'buyer@test', captureId: null, profileId: null });
    expect(await repo.orderByProviderId('fake', 'po-1')).toEqual(row);
    await repo.updateOrder(row.id, { captureId: 'cap-1', status: 'paid', paidAt: NOW });
    expect((await repo.orderByCaptureId('fake', 'cap-1'))?.id).toBe(row.id);
    expect(await repo.orderByCaptureId('paypal', 'cap-1')).toBeNull();
  });

  it('refuses a second order with the same provider order id or capture id', async () => {
    const o = await offer();
    const a = await order(o.id);
    await expect(order(o.id)).rejects.toThrow(/order/);
    const b = await order(o.id, { providerOrderId: 'po-2' });
    await repo.updateOrder(a.id, { captureId: 'cap-1' });
    await expect(repo.updateOrder(b.id, { captureId: 'cap-1' })).rejects.toThrow(/capture/);
  });

  it('lists orders of one space newest first', async () => {
    const o = await offer();
    await order(o.id, { providerOrderId: 'old', createdAt: new Date('2026-01-01') });
    await order(o.id, { providerOrderId: 'new', createdAt: new Date('2026-06-01') });
    expect((await repo.orders('s1')).map((r) => r.providerOrderId)).toEqual(['new', 'old']);
    expect(await repo.orders('s2')).toEqual([]);
  });

  it('links grants to their order', async () => {
    const o = await offer();
    const row = await order(o.id);
    const p = await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'a', title: 'A' });
    const g = await repo.createGrant({ productId: p.id, profileId: 'u1', source: 'purchase', orderId: row.id });
    expect(g.orderId).toBe(row.id);
    expect(await repo.grantsForOrder(row.id)).toEqual([g]);
  });
});

describe('payment credentials', () => {
  it('upserts per space and env, keeps the secret when none is given', async () => {
    const row = { spaceId: 's1', env: 'sandbox' as const, clientId: 'cid', webhookId: null, updatedAt: NOW };
    await repo.savePaymentCredentials(row, 'secret-1');
    await repo.savePaymentCredentials({ ...row, clientId: 'cid-2' }, null);
    expect(await repo.paymentCredentials('s1', 'sandbox')).toMatchObject({ clientId: 'cid-2' });
    expect(await repo.paymentSecret('s1', 'sandbox')).toBe('secret-1');
    expect(await repo.paymentCredentials('s1', 'live')).toBeNull();
    expect(await repo.paymentSecret('s1', 'live')).toBeNull();
  });
});

describe('contacts', () => {
  it('upserts by email, sets consent once and never withdraws it on a later purchase', async () => {
    await repo.upsertContact({ spaceId: 's1', email: 'A@Test', profileId: null, consent: { source: 'checkout', at: NOW } });
    const later = await repo.upsertContact({ spaceId: 's1', email: 'a@test', profileId: 'u1', consent: null });
    expect(later).toMatchObject({ email: 'a@test', profileId: 'u1', marketingConsent: true, consentSource: 'checkout' });
    expect(await repo.contacts('s1')).toHaveLength(1);
    expect(await repo.contacts('s2')).toEqual([]);
  });
});

describe('claim tokens', () => {
  it('consumes a valid token once; refuses expired ones', async () => {
    await repo.createClaimToken({ tokenHash: 'h1', spaceId: 's1', profileId: 'u1', expiresAt: new Date(NOW.getTime() + 1000), usedAt: null });
    await repo.createClaimToken({ tokenHash: 'h2', spaceId: 's1', profileId: 'u1', expiresAt: new Date(NOW.getTime() - 1000), usedAt: null });
    expect(await repo.consumeClaimToken('s1', 'h1', NOW)).toMatchObject({ profileId: 'u1', usedAt: NOW });
    expect(await repo.consumeClaimToken('s1', 'h1', NOW)).toBeNull();
    expect(await repo.consumeClaimToken('s1', 'h2', NOW)).toBeNull();
    expect(await repo.consumeClaimToken('s1', 'missing', NOW)).toBeNull();
  });

  it('refuses a token of another space and leaves it unused', async () => {
    await repo.createClaimToken({ tokenHash: 'h3', spaceId: 's1', profileId: 'u1', expiresAt: new Date(NOW.getTime() + 1000), usedAt: null });
    expect(await repo.consumeClaimToken('s2', 'h3', NOW)).toBeNull();
    expect(await repo.consumeClaimToken('s1', 'h3', NOW)).not.toBeNull();
  });
});
