// Price + currency inputs shared by the create and edit offer forms, and the price type (G5).
import { Field, Input, Select } from '@/components/ui/mds';
import { CURRENCIES, centsToDecimal, type Currency } from '@/lib/commerce/money';
import { INSTALLMENT_LIMITS, TRIAL_DAYS_MAX } from '@/lib/commerce/recurring';
import type { Offer } from '@/lib/data/types';
import styles from './Studio.module.css';

export function PriceFields({ priceCents, currency = 'EUR' }: { priceCents?: number; currency?: Currency }) {
  return (
    <div className={styles.row}>
      <Field label="Price" hint="Tax included. 0 = free.">
        <Input name="price" inputMode="decimal" required defaultValue={priceCents === undefined ? '' : centsToDecimal(priceCents)} />
      </Field>
      <Field label="Currency">
        <Select name="currency" defaultValue={currency}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

const KINDS = [
  ['one_time', 'One-time payment'],
  ['subscription', 'Subscription'],
  ['payment_plan', 'Payment plan'],
] as const;
const INTERVALS = [
  ['week', 'Weekly'],
  ['month', 'Monthly'],
  ['year', 'Annually'],
] as const;
const { week, month, year } = INSTALLMENT_LIMITS;
const PAYMENTS_HINT = `Payment plans only. Weekly ${week.min}-${week.max}, monthly ${month.min}-${month.max}, annually ${year.min}-${year.max}.`;

type Terms = Pick<Offer, 'kind' | 'billingInterval' | 'trialDays' | 'installments'>;

/** Kajabi price types. Only the fields of the chosen type are saved; the price is per payment. */
export function PriceTypeFields({ kind, billingInterval, trialDays, installments }: Terms) {
  return (
    <>
      <div className={styles.row}>
        <Field label="Price type" hint="Subscriptions and payment plans charge the price each interval.">
          <Select name="kind" defaultValue={kind}>
            {KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Billing interval">
          <Select name="interval" defaultValue={billingInterval ?? 'month'}>
            {INTERVALS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={styles.row}>
        <Field label="Trial days" hint={`Subscriptions only. Empty = no trial, at most ${TRIAL_DAYS_MAX}.`}>
          <Input name="trialDays" inputMode="numeric" defaultValue={trialDays ?? ''} />
        </Field>
        <Field label="Number of payments" hint={PAYMENTS_HINT}>
          <Input name="installments" inputMode="numeric" defaultValue={installments ?? ''} />
        </Field>
      </div>
    </>
  );
}
