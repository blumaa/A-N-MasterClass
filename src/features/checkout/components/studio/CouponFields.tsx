// Coupon inputs shared by the create and edit coupon forms (G23).
import { Badge, Field, Input } from '@/components/ui/mds';
import { formatMoney } from '@/lib/commerce/money';
import type { Coupon } from '@/lib/data/types';
import { DiscountFields } from './DiscountFields';

type Discount = Pick<Coupon, 'percentOff' | 'amountOffCents' | 'currency'>;

export const discountLabel = (c: Discount, locale: string): string =>
  c.percentOff !== null ? `${c.percentOff}% off` : `${formatMoney(c.amountOffCents ?? 0, c.currency ?? 'EUR', locale)} off`;

export function CouponState({ coupon, now }: { coupon: Pick<Coupon, 'active' | 'expiresAt'>; now: Date }) {
  if (!coupon.active) return <Badge tone="neutral">Off</Badge>;
  if (coupon.expiresAt && coupon.expiresAt <= now) return <Badge tone="warning">Expired</Badge>;
  return <Badge tone="success">Active</Badge>;
}

export function CodeAndDiscount({ coupon }: { coupon?: Pick<Coupon, 'code'> & Discount }) {
  return (
    <>
      <Field label="Code" hint="Buyers type it at checkout. Letters, digits, - and _.">
        <Input name="code" required defaultValue={coupon?.code ?? ''} />
      </Field>
      <DiscountFields coupon={coupon} />
    </>
  );
}
