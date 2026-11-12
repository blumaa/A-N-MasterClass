// Price + currency inputs shared by the create and edit offer forms.
import { Field, Input, Select } from '@/components/ui/mds';
import { CURRENCIES, centsToDecimal, type Currency } from '@/lib/commerce/money';
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
