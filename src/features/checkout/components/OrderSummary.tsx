// Order lines as the buyer will pay them (G23). Display only: the server prices the order.
import { Text } from '@/components/ui/mds';
import { formatMoney, type Currency } from '@/lib/commerce/money';
import styles from './OrderSummary.module.css';

type Props = {
  lines: { label: string; cents: number }[];
  totalCents: number;
  currency: Currency;
  locale: string;
};

export function OrderSummary({ lines, totalCents, currency, locale }: Props) {
  const money = (cents: number) => formatMoney(cents, currency, locale);
  return (
    <dl className={styles.summary}>
      {lines.map((line) => (
        <div key={line.label} className={styles.row}>
          <dt>
            <Text tone="secondary">{line.label}</Text>
          </dt>
          <dd>
            <Text tone="secondary">{line.cents < 0 ? `- ${money(-line.cents)}` : money(line.cents)}</Text>
          </dd>
        </div>
      ))}
      <div className={styles.row}>
        <dt>
          <Text variant="label">Total</Text>
        </dt>
        <dd data-testid="total">
          <Text variant="label">{totalCents === 0 ? 'Free' : money(totalCents)}</Text>
        </dd>
      </div>
    </dl>
  );
}
