import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { editOffers, studioOffer, studioOffers, type OfferTerms } from './offers';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string, space = 'alexander'): Promise<Viewer> => (await resolveViewer(repo, space, profileId))!;
const owner = () => as(SEED_IDS.alexanderOwner);
const ONE_TIME = { kind: 'one_time', billingInterval: null, trialDays: null, installments: null } as const;
const MONTHLY = { kind: 'subscription', billingInterval: 'month', trialDays: 7, installments: null } as const;

async function setTerms(id: string, terms: OfferTerms, priceCents = 1500) {
  const { title, slug } = (await repo.offer(id))!;
  const fields = { title, slug, description: '', priceCents, currency: 'EUR' as const };
  return editOffers(repo, await owner(), { op: 'update', offerId: id, ...fields, terms });
}

async function created(slug = 'full'): Promise<string> {
  const r = await editOffers(repo, await owner(), { op: 'create', title: 'Full access', slug, priceCents: 4900, currency: 'EUR' });
  if (!r.ok || !r.id) throw new Error('create failed');
  return r.id;
}

describe('studioOffers', () => {
  it('lists the space offers with product and sale counts, for offers.manage only', async () => {
    const id = await created();
    await editOffers(repo, await owner(), { op: 'setProducts', offerId: id, items: [{ productId: SEED_IDS.program, accessGroupId: null }] });
    const list = await studioOffers(repo, await owner());
    expect(list).toEqual([expect.objectContaining({ offer: expect.objectContaining({ id, status: 'draft' }), productCount: 1, sold: 0 })]);
    expect(await studioOffers(repo, await as(SEED_IDS.assistant))).toBeNull();
    expect(await studioOffers(repo, await as(SEED_IDS.student))).toBeNull();
  });
});

describe('studioOffer', () => {
  it('returns the offer, its linked products and the space products to pick from', async () => {
    const id = await created();
    const detail = await studioOffer(repo, await owner(), id);
    expect(detail?.offer.id).toBe(id);
    expect(detail?.items).toEqual([]);
    expect(detail?.products.map((p) => p.id)).toContain(SEED_IDS.program);
  });

  it('lists the extra access groups of each community to pick from', async () => {
    const id = await created();
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    const detail = await studioOffer(repo, await owner(), id);
    expect(detail?.products.find((p) => p.id === SEED_IDS.community)?.groups).toEqual([{ id: vip.id, title: 'VIP' }]);
    expect(detail?.products.find((p) => p.id === SEED_IDS.program)?.groups).toEqual([]);
  });

  it('hides an offer of another space', async () => {
    const id = await created();
    expect(await studioOffer(repo, await as(SEED_IDS.natashaOwner, 'natasha'), id)).toBeNull();
  });
});

describe('editOffers', () => {
  it('creates a draft offer and refuses a blank title, bad slug or duplicate slug', async () => {
    await created();
    const v = await owner();
    const base = { op: 'create' as const, priceCents: 0, currency: 'EUR' as const };
    expect(await editOffers(repo, v, { ...base, title: ' ', slug: 'x' })).toMatchObject({ error: 'invalid', message: 'Title is required.' });
    expect(await editOffers(repo, v, { ...base, title: 'X', slug: 'Bad Slug' })).toMatchObject({ error: 'invalid' });
    expect(await editOffers(repo, v, { ...base, title: 'X', slug: 'full' })).toMatchObject({ error: 'invalid' });
  });

  it('updates title, slug, description, price and currency', async () => {
    const id = await created();
    const r = await editOffers(repo, await owner(), {
      op: 'update',
      offerId: id,
      title: 'Full program',
      slug: 'program',
      description: '  Lifetime access. ',
      priceCents: 9900,
      currency: 'USD',
      terms: ONE_TIME,
    });
    expect(r).toEqual({ ok: true });
    expect(await repo.offer(id)).toMatchObject({ title: 'Full program', slug: 'program', description: 'Lifetime access.', priceCents: 9900, currency: 'USD' });
  });

  it('publishes only with at least one product; unpublish returns to draft', async () => {
    const id = await created();
    const v = await owner();
    expect(await editOffers(repo, v, { op: 'publish', offerId: id })).toMatchObject({ error: 'invalid', message: expect.stringMatching(/product/) });
    await editOffers(repo, v, { op: 'setProducts', offerId: id, items: [{ productId: SEED_IDS.program, accessGroupId: null }] });
    expect(await editOffers(repo, v, { op: 'publish', offerId: id })).toEqual({ ok: true });
    expect((await repo.offer(id))?.status).toBe('published');
    await editOffers(repo, v, { op: 'unpublish', offerId: id });
    expect((await repo.offer(id))?.status).toBe('draft');
  });

  it('refuses to unlink every product of a published offer', async () => {
    const id = await created();
    const v = await owner();
    await editOffers(repo, v, { op: 'setProducts', offerId: id, items: [{ productId: SEED_IDS.program, accessGroupId: null }] });
    await editOffers(repo, v, { op: 'publish', offerId: id });
    expect(await editOffers(repo, v, { op: 'setProducts', offerId: id, items: [] })).toMatchObject({ error: 'invalid' });
  });

  it('deletes an unsold offer; a sold one must be unpublished instead', async () => {
    const id = await created();
    const v = await owner();
    expect(await editOffers(repo, v, { op: 'delete', offerId: id })).toEqual({ ok: true });
    const sold = await created('sold');
    await repo.createOrder({
      spaceId: SEED_IDS.alexander,
      offerId: sold,
      email: 'b@test',
      provider: 'fake',
      providerOrderId: 'po-1',
      amountCents: 4900,
      currency: 'EUR',
      livemode: false,
      waiverVersion: 'v1',
      waiverAcceptedAt: NOW,
      marketingConsent: false,
      createdAt: NOW,
    });
    expect(await editOffers(repo, v, { op: 'delete', offerId: sold })).toMatchObject({ error: 'invalid', message: expect.stringMatching(/unpublish/i) });
  });

  it('refuses without offers.manage and for offers of another space', async () => {
    const id = await created();
    expect(await editOffers(repo, await as(SEED_IDS.assistant), { op: 'publish', offerId: id })).toEqual({ ok: false, error: 'forbidden' });
    expect(await editOffers(repo, await as(SEED_IDS.natashaOwner, 'natasha'), { op: 'delete', offerId: id })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('links a community with an access group', async () => {
    const id = await created();
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    const items = [{ productId: SEED_IDS.community, accessGroupId: vip.id }];
    expect(await editOffers(repo, await owner(), { op: 'setProducts', offerId: id, items })).toEqual({ ok: true });
    expect((await studioOffer(repo, await owner(), id))?.items).toEqual(items);
  });

  it('refuses products of another space', async () => {
    const id = await created();
    const foreign = await repo.createProduct({ spaceId: SEED_IDS.natasha, kind: 'program', slug: 'other', title: 'Other' });
    expect(await editOffers(repo, await owner(), { op: 'setProducts', offerId: id, items: [{ productId: foreign.id, accessGroupId: null }] })).toMatchObject({
      error: 'invalid',
    });
  });

  it('links a bump and an upsell offer, and clears them (G23)', async () => {
    const id = await created();
    const bump = await created('bump');
    const up = await created('up');
    const v = await owner();
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: id, bumpOfferId: bump, upsellOfferId: up })).toEqual({ ok: true });
    expect(await repo.offer(id)).toMatchObject({ bumpOfferId: bump, upsellOfferId: up });
    expect((await studioOffer(repo, v, id))?.others.map((o) => o.id).toSorted()).toEqual([bump, up].toSorted());
    await editOffers(repo, v, { op: 'setLinks', offerId: id, bumpOfferId: null, upsellOfferId: null });
    expect(await repo.offer(id)).toMatchObject({ bumpOfferId: null, upsellOfferId: null });
  });

  it('refuses a bump in another currency, a self link and an offer of another space (G23)', async () => {
    const id = await created();
    const v = await owner();
    const usd = await editOffers(repo, v, { op: 'create', title: 'Dollar', slug: 'usd', priceCents: 900, currency: 'USD' });
    if (!usd.ok || !usd.id) throw new Error('create failed');
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: id, bumpOfferId: usd.id, upsellOfferId: null })).toMatchObject({
      error: 'invalid',
      message: expect.stringMatching(/currency/),
    });
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: id, bumpOfferId: null, upsellOfferId: usd.id })).toEqual({ ok: true });
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: id, bumpOfferId: id, upsellOfferId: null })).toMatchObject({
      message: 'An offer cannot be its own bump or upsell.',
    });
    const foreign = await repo.createOffer({ spaceId: SEED_IDS.natasha, title: 'F', slug: 'f', priceCents: 100, currency: 'EUR' });
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: id, bumpOfferId: null, upsellOfferId: foreign.id })).toMatchObject({
      message: 'Pick offers of this site only.',
    });
  });

  it('sets the price type and drops a bump once the offer is recurring (G5)', async () => {
    const id = await created();
    const bump = await created('bump');
    await editOffers(repo, await owner(), { op: 'setLinks', offerId: id, bumpOfferId: bump, upsellOfferId: null });
    expect(await setTerms(id, MONTHLY)).toEqual({ ok: true });
    expect(await repo.offer(id)).toMatchObject({ ...MONTHLY, priceCents: 1500, bumpOfferId: null });
    const plan = { kind: 'payment_plan', billingInterval: 'month', trialDays: null, installments: 3 } as const;
    expect(await setTerms(id, plan)).toEqual({ ok: true });
    expect(await setTerms(id, ONE_TIME)).toEqual({ ok: true });
    expect(await repo.offer(id)).toMatchObject(ONE_TIME);
  });

  it('refuses free recurring offers, bad trials and installments out of Kajabi limits (G5)', async () => {
    const id = await created();
    expect(await setTerms(id, MONTHLY, 0)).toMatchObject({ message: 'Subscriptions and payment plans need a price above 0.' });
    expect(await setTerms(id, { ...MONTHLY, trialDays: 400 })).toMatchObject({ message: 'Free trial: 1 to 365 days.' });
    const plan = { kind: 'payment_plan', billingInterval: 'year', trialDays: null, installments: 6 } as const;
    expect(await setTerms(id, plan)).toMatchObject({ message: 'Annual payment plans take 2 to 5 payments.' });
    expect(await repo.offer(id)).toMatchObject(ONE_TIME);
  });

  it('allows order bumps between one-time offers only (G5)', async () => {
    const id = await created();
    const sub = await created('sub');
    expect(await setTerms(sub, MONTHLY)).toEqual({ ok: true });
    const v = await owner();
    const message = 'Order bumps work with one-time offers only.';
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: id, bumpOfferId: sub, upsellOfferId: null })).toMatchObject({ message });
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: sub, bumpOfferId: id, upsellOfferId: null })).toMatchObject({ message });
    expect(await editOffers(repo, v, { op: 'setLinks', offerId: sub, bumpOfferId: null, upsellOfferId: id })).toEqual({ ok: true });
  });
});
