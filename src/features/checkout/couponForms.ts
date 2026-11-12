// Studio coupon forms -> typed DAL commands (G23). Amount text becomes cents here.
// Expiry is a date: the coupon stops working at 00:00 UTC that day.
import { CURRENCIES, parsePrice } from '@/lib/commerce/money';
import { parser, readWhole } from '@/lib/forms/commands';
import { FormError, type FormReader } from '@/lib/forms/formReader';
import type { CouponCommand, CouponFields } from './api/coupons';

const DISCOUNT_TYPES = ['percent', 'amount'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function discount(r: FormReader): Pick<CouponFields, 'percentOff' | 'amountOffCents' | 'currency'> {
  if (r.oneOf('discountType', DISCOUNT_TYPES) === 'percent') {
    return { percentOff: readWhole(r, 'discount', 'the percent'), amountOffCents: null, currency: null };
  }
  const cents = parsePrice(r.required('discount'));
  if (cents === null) throw new FormError('Enter an amount like 5 or 5.50.');
  return { percentOff: null, amountOffCents: cents, currency: r.oneOf('currency', CURRENCIES) };
}

function expiresAt(r: FormReader): Date | null {
  const v = r.raw('expiresAt') ?? '';
  if (!v) return null;
  if (!DATE.test(v)) throw new FormError('Use a date like 2026-12-31.');
  return new Date(`${v}T00:00:00Z`);
}

function fields(r: FormReader): CouponFields {
  return {
    code: r.required('code'),
    ...discount(r),
    maxUses: r.raw('maxUses') ? readWhole(r, 'maxUses', 'max uses') : null,
    oncePerCustomer: r.raw('oncePerCustomer') === 'on',
    expiresAt: expiresAt(r),
    offerIds: r.all('offerId'),
  };
}

export const couponCommandFromForm = parser<CouponCommand>({
  create: (r) => ({ op: 'create', ...fields(r) }),
  update: (r) => ({ op: 'update', couponId: r.required('couponId'), ...fields(r), active: r.raw('active') === 'on' }),
  delete: (r) => ({ op: 'delete', couponId: r.required('couponId') }),
});
