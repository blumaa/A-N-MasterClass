// Supabase Repo: coupons (G23). Semantics mirror src/lib/data/fake/fakeCouponRepo.ts; rules live in
// 20261112170000_coupons_bumps_upsells.sql. Coupons are offers.manage-only under RLS, so the
// public checkout reads them through the service repo; uses and the "show the field" check use
// admin() because a guest buyer has no session.
import { ConstraintError, COUPON_OFFER_SPACE } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import { check, defined, isoOrNull, unwrap, unwrapMaybe, type Db, type RepoCtx } from './context';
import { toCoupon } from './mapCommerce';

export type CouponRepo = Pick<
  Repo,
  'coupons' | 'coupon' | 'couponByCode' | 'createCoupon' | 'updateCoupon' | 'deleteCoupon' | 'couponUses' | 'hasActiveCoupon'
>;

const WITH_OFFERS = '*, coupon_offers(offer_id)';

/** Validated before any write, so a bad offer leaves the coupon and its old links intact. */
async function checkOffers(c: Db, spaceId: string, offerIds: readonly string[]): Promise<void> {
  if (offerIds.length === 0) return;
  const rows = unwrap(await c.from('offers').select('id, space_id').in('id', [...offerIds]));
  const inSpace = new Set(rows.filter((r) => r.space_id === spaceId).map((r) => r.id));
  if (offerIds.some((id) => !inSpace.has(id))) throw new ConstraintError(COUPON_OFFER_SPACE);
}

async function replaceOffers(c: Db, couponId: string, spaceId: string, offerIds: readonly string[]): Promise<void> {
  check(await c.from('coupon_offers').delete().eq('coupon_id', couponId));
  if (offerIds.length === 0) return;
  check(await c.from('coupon_offers').insert(offerIds.map((offer_id) => ({ coupon_id: couponId, offer_id, space_id: spaceId }))));
}

export function createCouponRepo({ db, admin }: RepoCtx): CouponRepo {
  const byId = async (c: Db, id: string) =>
    unwrapMaybe(await c.from('coupons').select(WITH_OFFERS).eq('id', id).maybeSingle());
  const written = async (c: Db, id: string) => {
    const row = await byId(c, id);
    if (!row) throw new Error(`coupon ${id} not found`);
    return toCoupon(row);
  };

  return {
    async coupons(spaceId) {
      const rows = unwrap(await (await db()).from('coupons').select(WITH_OFFERS).eq('space_id', spaceId).order('code'));
      return rows.map(toCoupon);
    },
    async coupon(id) {
      const row = await byId(await db(), id);
      return row && toCoupon(row);
    },
    async couponByCode(spaceId, code) {
      const row = unwrapMaybe(
        await (await db()).from('coupons').select(WITH_OFFERS).eq('space_id', spaceId).eq('code', code.toUpperCase()).maybeSingle(),
      );
      return row && toCoupon(row);
    },
    async createCoupon(input) {
      const c = await db();
      const offerIds = [...new Set(input.offerIds)];
      await checkOffers(c, input.spaceId, offerIds);
      const row = unwrap(
        await c
          .from('coupons')
          .insert({
            space_id: input.spaceId,
            code: input.code.toUpperCase(),
            percent_off: input.percentOff,
            amount_off_cents: input.amountOffCents,
            currency: input.currency,
            max_uses: input.maxUses,
            once_per_customer: input.oncePerCustomer,
            expires_at: isoOrNull(input.expiresAt),
            active: input.active,
          })
          .select('id')
          .single(),
      );
      await replaceOffers(c, row.id, input.spaceId, offerIds);
      return written(c, row.id);
    },
    async updateCoupon(id, patch) {
      const c = await db();
      const current = unwrap(await c.from('coupons').select('space_id').eq('id', id).single());
      const offerIds = patch.offerIds && [...new Set(patch.offerIds)];
      if (offerIds) await checkOffers(c, current.space_id, offerIds);
      const columns = defined({
        code: patch.code?.toUpperCase(),
        percent_off: patch.percentOff,
        amount_off_cents: patch.amountOffCents,
        currency: patch.currency,
        max_uses: patch.maxUses,
        once_per_customer: patch.oncePerCustomer,
        expires_at: isoOrNull(patch.expiresAt),
        active: patch.active,
      });
      if (Object.keys(columns).length > 0) check(await c.from('coupons').update(columns).eq('id', id));
      if (offerIds) await replaceOffers(c, id, current.space_id, offerIds);
      return written(c, id);
    },
    // Orders reference coupons with on delete restrict: a used coupon cannot go.
    async deleteCoupon(id) {
      check(await (await db()).from('coupons').delete().eq('id', id));
    },
    async couponUses(couponId, email) {
      const paid = () => admin().from('orders').select('id', { count: 'exact', head: true }).eq('coupon_id', couponId).neq('status', 'created');
      const [total, byEmail] = await Promise.all([paid(), paid().eq('email', email.toLowerCase())]);
      check(total);
      check(byEmail);
      return { total: total.count ?? 0, byEmail: byEmail.count ?? 0 };
    },
    async hasActiveCoupon(offerId, now) {
      const rows = unwrap(
        await admin()
          .from('coupon_offers')
          .select('coupons!inner(id)')
          .eq('offer_id', offerId)
          .eq('coupons.active', true)
          .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`, { referencedTable: 'coupons' })
          .limit(1),
      );
      return rows.length > 0;
    },
  };
}
