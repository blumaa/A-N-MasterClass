// Studio coupons DAL (G23): list, create, edit, delete. offers.manage only (G15).
// Kajabi: https://help.kajabi.com/articles/sales/coupons/how-to-create-a-coupon,
// report: https://help.kajabi.com/en/articles/17174770-coupon-analytics
// Code, discount, limits and links are checked by the repo constraints and reported as invalid.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import {
  COUPON_CODE,
  COUPON_CODE_TAKEN,
  COUPON_DISCOUNT,
  COUPON_HAS_ORDERS,
  COUPON_MAX_USES,
  COUPON_OFFER_SPACE,
  ConstraintError,
} from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { Currency } from '@/lib/commerce/money';
import type { Coupon, Offer, Order } from '@/lib/data/types';

export type CouponFields = Pick<
  Coupon,
  'code' | 'percentOff' | 'amountOffCents' | 'currency' | 'maxUses' | 'oncePerCustomer' | 'expiresAt' | 'offerIds'
>;

export type CouponCommand =
  | ({ op: 'create' } & CouponFields)
  | ({ op: 'update'; couponId: string; active: boolean } & CouponFields)
  | { op: 'delete'; couponId: string };

/** uses: paid orders (status past 'created'), the same count checkout limits by. */
export type StudioCouponRow = { coupon: Coupon; uses: number };

export type CouponOrder = Pick<
  Order,
  'id' | 'email' | 'amountCents' | 'discountCents' | 'currency' | 'status' | 'livemode' | 'createdAt'
> & { offerTitle: string };
/** Money of live orders, not fully refunded (a partial refund amount is not stored). */
export type CouponTotals = { currency: Currency; revenueCents: number; discountCents: number };
/** Kajabi coupon analytics: redemptions + unique customers; we add money and the orders. */
export type CouponReport = { uses: number; customers: number; totals: CouponTotals[]; orders: CouponOrder[] };
export type StudioCouponDetail = {
  coupon: Coupon;
  report: CouponReport;
  offers: Pick<Offer, 'id' | 'title' | 'slug' | 'currency'>[];
};

const MESSAGES: Record<string, string> = {
  [COUPON_CODE]: 'Use 3 to 32 letters, digits, dashes or underscores for the code.',
  [COUPON_CODE_TAKEN]: 'Another coupon already uses this code.',
  [COUPON_DISCOUNT]: 'Enter a percent from 1 to 100, or an amount with a currency.',
  [COUPON_MAX_USES]: 'Max uses must be at least 1. Leave it empty for no limit.',
  [COUPON_HAS_ORDERS]: 'This coupon was used and cannot be deleted. Turn it off instead.',
  [COUPON_OFFER_SPACE]: 'Pick offers of this site only.',
};

/** A coupon order counts as a use once past 'created' (same rule checkout limits by). */
const isUse = (o: Order): boolean => o.status !== 'created';

async function usesBySpace(repo: Repo, spaceId: string): Promise<Map<string, number>> {
  const uses = new Map<string, number>();
  for (const o of await repo.orders(spaceId)) {
    if (o.couponId !== null && isUse(o)) uses.set(o.couponId, (uses.get(o.couponId) ?? 0) + 1);
  }
  return uses;
}

/** orders: newest first (repo order). */
export function couponReport(couponId: string, orders: readonly Order[], offers: readonly Pick<Offer, 'id' | 'title'>[]): CouponReport {
  const titles = new Map(offers.map((o) => [o.id, o.title]));
  const used = orders.filter((o) => o.couponId === couponId && isUse(o));
  const totals = new Map<Currency, CouponTotals>();
  for (const o of used) {
    if (!o.livemode || o.status === 'refunded') continue;
    const t = totals.get(o.currency) ?? { currency: o.currency, revenueCents: 0, discountCents: 0 };
    t.revenueCents += o.amountCents;
    t.discountCents += o.discountCents;
    totals.set(o.currency, t);
  }
  return {
    uses: used.length,
    customers: new Set(used.map((o) => o.email)).size,
    totals: [...totals.values()],
    orders: used.map((o) => ({
      id: o.id,
      email: o.email,
      offerTitle: titles.get(o.offerId) ?? '',
      amountCents: o.amountCents,
      discountCents: o.discountCents,
      currency: o.currency,
      status: o.status,
      livemode: o.livemode,
      createdAt: o.createdAt,
    })),
  };
}

async function ownCoupon(repo: Repo, viewer: Viewer, couponId: string): Promise<Coupon | null> {
  const coupon = await repo.coupon(couponId);
  return coupon && coupon.spaceId === viewer.space.id ? coupon : null;
}

export async function studioCoupons(repo: Repo, viewer: Viewer): Promise<StudioCouponRow[] | null> {
  if (!viewerCan(viewer, 'offers.manage')) return null;
  const [coupons, uses] = await Promise.all([repo.coupons(viewer.space.id), usesBySpace(repo, viewer.space.id)]);
  return coupons.map((coupon) => ({ coupon, uses: uses.get(coupon.id) ?? 0 }));
}

export async function studioCoupon(repo: Repo, viewer: Viewer, couponId: string): Promise<StudioCouponDetail | null> {
  if (!viewerCan(viewer, 'offers.manage')) return null;
  const [coupon, offers, orders] = await Promise.all([
    ownCoupon(repo, viewer, couponId),
    repo.offers(viewer.space.id),
    repo.orders(viewer.space.id),
  ]);
  if (!coupon) return null;
  return {
    coupon,
    report: couponReport(coupon.id, orders, offers),
    offers: offers.map(({ id, title, slug, currency }) => ({ id, title, slug, currency })),
  };
}

export async function editCoupons(repo: Repo, viewer: Viewer, cmd: CouponCommand): Promise<CommandResult> {
  if (!viewerCan(viewer, 'offers.manage')) return { ok: false, error: 'forbidden' };
  try {
    if (cmd.op === 'create') {
      const { op: _op, ...fields } = cmd;
      const coupon = await repo.createCoupon({ ...fields, spaceId: viewer.space.id, active: true });
      return { ok: true, id: coupon.id };
    }
    if (!(await ownCoupon(repo, viewer, cmd.couponId))) return { ok: false, error: 'not_found' };
    if (cmd.op === 'delete') {
      await repo.deleteCoupon(cmd.couponId);
      return { ok: true };
    }
    const { op: _op, couponId, ...patch } = cmd;
    await repo.updateCoupon(couponId, patch);
    return { ok: true };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: MESSAGES[e.message] ?? e.message };
    throw e;
  }
}
