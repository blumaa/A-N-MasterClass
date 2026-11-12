// Studio coupons DAL (G23): list, create, edit, delete. offers.manage only (G15).
// Kajabi: https://help.kajabi.com/articles/sales/coupons/how-to-create-a-coupon
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
import type { Coupon, Offer } from '@/lib/data/types';

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
export type StudioCouponDetail = StudioCouponRow & { offers: Pick<Offer, 'id' | 'title' | 'currency'>[] };

const MESSAGES: Record<string, string> = {
  [COUPON_CODE]: 'Use 3 to 32 letters, digits, dashes or underscores for the code.',
  [COUPON_CODE_TAKEN]: 'Another coupon already uses this code.',
  [COUPON_DISCOUNT]: 'Enter a percent from 1 to 100, or an amount with a currency.',
  [COUPON_MAX_USES]: 'Max uses must be at least 1. Leave it empty for no limit.',
  [COUPON_HAS_ORDERS]: 'This coupon was used and cannot be deleted. Turn it off instead.',
  [COUPON_OFFER_SPACE]: 'Pick offers of this site only.',
};

async function usesBySpace(repo: Repo, spaceId: string): Promise<Map<string, number>> {
  const uses = new Map<string, number>();
  for (const o of await repo.orders(spaceId)) {
    if (o.couponId !== null && o.status !== 'created') uses.set(o.couponId, (uses.get(o.couponId) ?? 0) + 1);
  }
  return uses;
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
  const [coupon, offers, uses] = await Promise.all([
    ownCoupon(repo, viewer, couponId),
    repo.offers(viewer.space.id),
    usesBySpace(repo, viewer.space.id),
  ]);
  if (!coupon) return null;
  return {
    coupon,
    uses: uses.get(coupon.id) ?? 0,
    offers: offers.map(({ id, title, currency }) => ({ id, title, currency })),
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
