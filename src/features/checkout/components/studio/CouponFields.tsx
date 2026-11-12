// Coupon inputs shared by the create and edit coupon forms (G23).
import { Badge, Field, Input, Select } from '@/components/ui/mds';
import { CURRENCIES, centsToDecimal, formatMoney } from '@/lib/commerce/money';
import type { Coupon } from '@/lib/data/types';
import styles from './Studio.module.css';

type Discount = Pick<Coupon, 'percentOff' | 'amountOffCents' | 'currency'>;

export const discountLabel = (c: Discount, locale: string): string =>
  c.percentOff !== null ? `${c.percentOff}% off` : `${formatMoney(c.amountOffCents ?? 0, c.currency ?? 'EUR', locale)} off`;

export function CouponState({ coupon, now }: { coupon: Pick<Coupon, 'active' | 'expiresAt'>; now: Date }) {
  if (!coupon.active) return <Badge tone="neutral">Off</Badge>;
  if (coupon.expiresAt && coupon.expiresAt <= now) return <Badge tone="warning">Expired</Badge>;
  return <Badge tone="success">Active</Badge>;
}

export function CodeAndDiscount({ coupon }: { coupon?: Pick<Coupon, 'code'> & Discount }) {
  const amount = coupon?.amountOffCents ?? null;
  return (
    <>
      <Field label="Code" hint="Buyers type it at checkout. Letters, digits, - and _.">
        <Input name="code" required defaultValue={coupon?.code ?? ''} />
      </Field>
      <div className={styles.row}>
        <Field label="Discount type">
          <Select name="discountType" defaultValue={amount === null ? 'percent' : 'amount'}>
            <option value="percent">Percent</option>
            <option value="amount">Amount</option>
          </Select>
        </Field>
        <Field label="Discount" hint="A percent (1-100) or an amount, like 5.50.">
          <Input
            name="discount"
            inputMode="decimal"
            required
            defaultValue={amount === null ? String(coupon?.percentOff ?? '') : centsToDecimal(amount)}
          />
        </Field>
        <Field label="Currency" hint="Amount coupons only.">
          <Select name="currency" defaultValue={coupon?.currency ?? 'EUR'}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
}
