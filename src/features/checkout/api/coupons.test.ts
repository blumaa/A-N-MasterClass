import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { editCoupons, studioCoupon, studioCoupons, type CouponFields } from './coupons';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let offerId: string;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  offerId = (await repo.createOffer({ spaceId: SEED_IDS.alexander, title: 'Full', slug: 'full', priceCents: 4900, currency: 'EUR' })).id;
});

const as = async (profileId: string, space = 'alexander'): Promise<Viewer> => (await resolveViewer(repo, space, profileId))!;
const owner = () => as(SEED_IDS.alexanderOwner);

const fields = (over: Partial<CouponFields> = {}): CouponFields => ({
  code: 'save10',
  percentOff: 10,
  amountOffCents: null,
  currency: null,
  maxUses: null,
  oncePerCustomer: false,
  expiresAt: null,
  offerIds: [offerId],
  ...over,
});

async function created(over: Partial<CouponFields> = {}): Promise<string> {
  const r = await editCoupons(repo, await owner(), { op: 'create', ...fields(over) });
  if (!r.ok || !r.id) throw new Error('create failed');
  return r.id;
}

async function paidOrder(couponId: string, email: string, status: 'created' | 'paid' = 'paid') {
  const o = await repo.createOrder({
    spaceId: SEED_IDS.alexander,
    offerId,
    email,
    provider: 'fake',
    providerOrderId: `po-${email}-${status}`,
    amountCents: 4410,
    couponId,
    discountCents: 490,
    currency: 'EUR',
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: NOW,
    marketingConsent: false,
    createdAt: NOW,
  });
  if (status === 'paid') await repo.updateOrder(o.id, { status: 'paid', paidAt: NOW });
}

describe('studioCoupons', () => {
  it('lists coupons with paid uses, for offers.manage only', async () => {
    const id = await created();
    await paidOrder(id, 'a@test');
    await paidOrder(id, 'b@test', 'created');
    expect(await studioCoupons(repo, await owner())).toEqual([{ coupon: expect.objectContaining({ id, code: 'SAVE10' }), uses: 1 }]);
    expect(await studioCoupons(repo, await as(SEED_IDS.assistant))).toBeNull();
  });
});

describe('studioCoupon', () => {
  it('returns the coupon, its uses and the space offers to pick from', async () => {
    const id = await created();
    const detail = await studioCoupon(repo, await owner(), id);
    expect(detail).toMatchObject({ coupon: { id }, uses: 0, offers: [{ id: offerId, title: 'Full', currency: 'EUR' }] });
  });

  it('hides a coupon of another space or without offers.manage', async () => {
    const id = await created();
    expect(await studioCoupon(repo, await as(SEED_IDS.natashaOwner, 'natasha'), id)).toBeNull();
    expect(await studioCoupon(repo, await as(SEED_IDS.assistant), id)).toBeNull();
  });
});

describe('editCoupons', () => {
  it('creates an active coupon with an uppercase code', async () => {
    const id = await created({ maxUses: 5, oncePerCustomer: true, expiresAt: new Date('2026-12-01T00:00:00Z') });
    expect(await repo.coupon(id)).toMatchObject({ code: 'SAVE10', active: true, maxUses: 5, oncePerCustomer: true, offerIds: [offerId] });
  });

  it('reports bad input as invalid', async () => {
    const v = await owner();
    await created();
    const create = (over: Partial<CouponFields>) => editCoupons(repo, v, { op: 'create', ...fields(over) });
    expect(await create({ code: 'save10' })).toMatchObject({ message: 'Another coupon already uses this code.' });
    expect(await create({ code: 'a b' })).toMatchObject({ message: expect.stringMatching(/3 to 32/) });
    expect(await create({ code: 'BIG', percentOff: 150 })).toMatchObject({ message: expect.stringMatching(/percent/i) });
    expect(await create({ code: 'CAP', maxUses: 0 })).toMatchObject({ message: expect.stringMatching(/at least 1/) });
  });

  it('updates the discount, links and active flag', async () => {
    const id = await created();
    const r = await editCoupons(repo, await owner(), {
      op: 'update',
      couponId: id,
      ...fields({ percentOff: null, amountOffCents: 500, currency: 'EUR', offerIds: [] }),
      active: false,
    });
    expect(r).toEqual({ ok: true });
    expect(await repo.coupon(id)).toMatchObject({ percentOff: null, amountOffCents: 500, currency: 'EUR', offerIds: [], active: false });
  });

  it('deletes an unused coupon; a used one must be turned off instead', async () => {
    const v = await owner();
    expect(await editCoupons(repo, v, { op: 'delete', couponId: await created() })).toEqual({ ok: true });
    const used = await created({ code: 'USED' });
    await paidOrder(used, 'a@test');
    expect(await editCoupons(repo, v, { op: 'delete', couponId: used })).toMatchObject({
      error: 'invalid',
      message: expect.stringMatching(/turn it off/i),
    });
  });

  it('refuses without offers.manage, coupons of another space and offers of another space', async () => {
    const id = await created();
    expect(await editCoupons(repo, await as(SEED_IDS.assistant), { op: 'delete', couponId: id })).toEqual({ ok: false, error: 'forbidden' });
    expect(await editCoupons(repo, await as(SEED_IDS.natashaOwner, 'natasha'), { op: 'delete', couponId: id })).toEqual({
      ok: false,
      error: 'not_found',
    });
    const foreign = await repo.createOffer({ spaceId: SEED_IDS.natasha, title: 'F', slug: 'f', priceCents: 100, currency: 'EUR' });
    expect(await editCoupons(repo, await owner(), { op: 'create', ...fields({ code: 'FOREIGN', offerIds: [foreign.id] }) })).toMatchObject({
      message: 'Pick offers of this site only.',
    });
  });
});
