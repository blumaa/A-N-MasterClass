'use client';
// Offer price type (G5). Shows only the fields of the chosen type, Kajabi way.
import { useState } from 'react';
import { Field, Input, Select } from '@/components/ui/mds';
import { INSTALLMENT_LIMITS, TRIAL_DAYS_MAX } from '@/lib/commerce/recurring';
import type { Offer } from '@/lib/data/types';
import styles from './Studio.module.css';

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
const PAYMENTS_HINT = `Weekly ${week.min}-${week.max}, monthly ${month.min}-${month.max}, annually ${year.min}-${year.max}.`;

type Terms = Pick<Offer, 'kind' | 'billingInterval' | 'trialDays' | 'installments'>;

/** The price is per payment. The server keeps only the chosen type's fields. */
export function PriceTypeFields({ kind: initialKind, billingInterval, trialDays, installments }: Terms) {
  const [kind, setKind] = useState(initialKind);
  const recurring = kind !== 'one_time';
  return (
    <div className={styles.row}>
      <Field label="Price type" hint={recurring ? 'Charged each interval.' : undefined}>
        <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Offer['kind'])}>
          {KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {recurring ? (
        <Field label="Billing interval">
          <Select name="interval" defaultValue={billingInterval ?? 'month'}>
            {INTERVALS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {kind === 'subscription' ? (
        <Field label="Trial days" hint={`Empty = no trial, at most ${TRIAL_DAYS_MAX}.`}>
          <Input name="trialDays" inputMode="numeric" defaultValue={trialDays ?? ''} />
        </Field>
      ) : null}
      {kind === 'payment_plan' ? (
        <Field label="Number of payments" hint={PAYMENTS_HINT}>
          <Input name="installments" inputMode="numeric" defaultValue={installments ?? ''} />
        </Field>
      ) : null}
    </div>
  );
}
