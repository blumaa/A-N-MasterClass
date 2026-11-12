'use client';
// Coupon discount type + value. The currency shows only for amount coupons (G23).
import { useState } from 'react';
import { Field, Input, Select } from '@/components/ui/mds';
import { CURRENCIES, centsToDecimal } from '@/lib/commerce/money';
import type { Coupon } from '@/lib/data/types';
import styles from './Studio.module.css';

type Discount = Pick<Coupon, 'percentOff' | 'amountOffCents' | 'currency'>;

export function DiscountFields({ coupon }: { coupon?: Discount }) {
  const amount = coupon?.amountOffCents ?? null;
  const [type, setType] = useState<'percent' | 'amount'>(amount === null ? 'percent' : 'amount');
  return (
    <div className={styles.row}>
      <Field label="Discount type">
        <Select name="discountType" value={type} onChange={(e) => setType(e.target.value === 'amount' ? 'amount' : 'percent')}>
          <option value="percent">Percent</option>
          <option value="amount">Amount</option>
        </Select>
      </Field>
      <Field label="Discount" hint={type === 'percent' ? '1-100.' : 'Like 5.50.'}>
        <Input name="discount" inputMode="decimal" required defaultValue={amount === null ? String(coupon?.percentOff ?? '') : centsToDecimal(amount)} />
      </Field>
      {type === 'amount' ? (
        <Field label="Currency">
          <Select name="currency" defaultValue={coupon?.currency ?? 'EUR'}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </div>
  );
}
