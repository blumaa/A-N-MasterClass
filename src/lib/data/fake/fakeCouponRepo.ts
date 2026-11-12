// Coupon part of the fake repo (G23). Same rules as coupons / coupon_offers in
// supabase/migrations/20261112170000_coupons_bumps_upsells.sql.
import {
  COUPON_CODE,
  COUPON_CODE_TAKEN,
  COUPON_DISCOUNT,
  COUPON_HAS_ORDERS,
  COUPON_MAX_USES,
  COUPON_OFFER_SPACE,
  ConstraintError,
} from '../errors';
import type { Repo } from '../repo';
import type { Coupon } from '../types';
import type { Db } from './db';

type CouponRepo = Pick<
  Repo,
  'coupons' | 'coupon' | 'couponByCode' | 'createCoupon' | 'updateCoupon' | 'deleteCoupon' | 'couponUses' | 'hasActiveCoupon'
>;

const CODE = /^[A-Z0-9_-]{3,32}$/;

function checkCoupon(db: Db, row: Coupon): void {
  if (!CODE.test(row.code)) throw new ConstraintError(COUPON_CODE);
  if (db.coupons.some((c) => c.spaceId === row.spaceId && c.id !== row.id && c.code === row.code)) {
    throw new ConstraintError(COUPON_CODE_TAKEN);
  }
  const percent = row.percentOff !== null && Number.isInteger(row.percentOff) && row.percentOff >= 1 && row.percentOff <= 100;
  const amount = row.amountOffCents !== null && Number.isInteger(row.amountOffCents) && row.amountOffCents > 0;
  const valid = percent ? row.amountOffCents === null && row.currency === null : amount && row.percentOff === null && row.currency !== null;
  if (!valid) throw new ConstraintError(COUPON_DISCOUNT);
  if (row.maxUses !== null && row.maxUses < 1) throw new ConstraintError(COUPON_MAX_USES);
  if (row.offerIds.some((oid) => db.offers.find((o) => o.id === oid)?.spaceId !== row.spaceId)) {
    throw new ConstraintError(COUPON_OFFER_SPACE);
  }
}

const copy = (c: Coupon): Coupon => ({ ...c, offerIds: [...c.offerIds] });

export function createFakeCouponRepo(db: Db, id: (prefix: string) => string): CouponRepo {
  const find = (cid: string): Coupon => {
    const row = db.coupons.find((c) => c.id === cid);
    if (!row) throw new Error('coupon not found');
    return row;
  };

  return {
    coupons: async (spaceId) =>
      db.coupons.filter((c) => c.spaceId === spaceId).toSorted((a, b) => a.code.localeCompare(b.code)).map(copy),
    coupon: async (cid) => {
      const row = db.coupons.find((c) => c.id === cid);
      return row ? copy(row) : null;
    },
    couponByCode: async (spaceId, code) => {
      const row = db.coupons.find((c) => c.spaceId === spaceId && c.code === code.toUpperCase());
      return row ? copy(row) : null;
    },
    async createCoupon(input) {
      const row: Coupon = { ...input, code: input.code.toUpperCase(), offerIds: [...new Set(input.offerIds)], id: id('coupon'), createdAt: new Date() };
      checkCoupon(db, row);
      db.coupons.push(row);
      return copy(row);
    },
    async updateCoupon(cid, patch) {
      const row = find(cid);
      const next = { ...row, ...patch };
      next.code = next.code.toUpperCase();
      next.offerIds = [...new Set(next.offerIds)];
      checkCoupon(db, next);
      return copy(Object.assign(row, next));
    },
    async deleteCoupon(cid) {
      if (db.orders.some((o) => o.couponId === cid)) throw new ConstraintError(COUPON_HAS_ORDERS);
      db.coupons = db.coupons.filter((c) => c.id !== cid);
    },
    async couponUses(cid, email) {
      const used = db.orders.filter((o) => o.couponId === cid && o.status !== 'created');
      const key = email.toLowerCase();
      return { total: used.length, byEmail: used.filter((o) => o.email === key).length };
    },
    hasActiveCoupon: async (offerId, now) =>
      db.coupons.some((c) => c.active && c.offerIds.includes(offerId) && (c.expiresAt === null || c.expiresAt > now)),
  };
}
