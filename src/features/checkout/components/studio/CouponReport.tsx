'use client';
// Coupon report (Kajabi coupon analytics: https://help.kajabi.com/en/articles/17174770-coupon-analytics).
// Uses + unique customers as Kajabi; we add live revenue, discount given and the orders.
// Client: DataTable takes cell functions.
import { Badge, DataTable, Heading, Inline, Stack, Text } from '@/components/ui/mds';
import { formatMoney } from '@/lib/commerce/money';
import type { CouponOrder, CouponReport as Report, CouponTotals } from '../../api/coupons';
import styles from './Studio.module.css';

const sum = (totals: readonly CouponTotals[], pick: (t: CouponTotals) => number, locale: string): string =>
  totals.length === 0 ? 'None' : totals.map((t) => formatMoney(pick(t), t.currency, locale)).join(', ');

export function CouponReport({ report, locale }: { report: Report; locale: string }) {
  const stats = [
    ['Uses', String(report.uses)],
    ['Customers', String(report.customers)],
    ['Revenue', sum(report.totals, (t) => t.revenueCents, locale)],
    ['Discount given', sum(report.totals, (t) => t.discountCents, locale)],
  ];
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Report
      </Heading>
      <dl className={styles.stats}>
        {stats.map(([label, value]) => (
          <div key={label} className={styles.stat}>
            <dt>
              <Text variant="note" tone="secondary">
                {label}
              </Text>
            </dt>
            <dd>
              <Text variant="label">{value}</Text>
            </dd>
          </div>
        ))}
      </dl>
      <Text variant="note">Revenue and discount count live orders only, without fully refunded ones.</Text>
      <DataTable<CouponOrder>
        label="Orders with this coupon"
        rows={report.orders}
        rowKey={(o) => o.id}
        empty="No orders used this coupon yet."
        columns={[
          { key: 'date', header: 'Date', cell: (o) => o.createdAt.toLocaleDateString(locale), sortValue: (o) => o.createdAt.getTime() },
          { key: 'email', header: 'Customer', cell: (o) => o.email, sortValue: (o) => o.email },
          { key: 'offer', header: 'Offer', cell: (o) => o.offerTitle },
          { key: 'amount', header: 'Paid', cell: (o) => formatMoney(o.amountCents, o.currency, locale), sortValue: (o) => o.amountCents },
          { key: 'discount', header: 'Discount', cell: (o) => formatMoney(o.discountCents, o.currency, locale) },
          {
            key: 'status',
            header: 'Status',
            cell: (o) => (
              <Inline gap="tight">
                <span>{o.status.replace('_', ' ')}</span>
                {o.livemode ? null : <Badge tone="warning">Test</Badge>}
              </Inline>
            ),
          },
        ]}
      />
    </Stack>
  );
}
