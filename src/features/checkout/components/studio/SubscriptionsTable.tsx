'use client';
// Studio > Customers: subscriptions and payment plans with their status (G5).
import { Badge, DataTable, Inline } from '@/components/ui/mds';
import { priceTermsLabel } from '@/lib/commerce/recurring';
import type { SubscriptionRow } from '../../api/subscriptionRows';
import { subscriptionStatusLabel } from '../subscriptionLabels';

const date = (d: Date | null, locale: string) => (d ? d.toLocaleDateString(locale) : '');

const payments = (s: SubscriptionRow) =>
  s.terms.installments ? `${s.paymentsMade} of ${s.terms.installments}` : String(s.paymentsMade);

export function SubscriptionsTable({ rows, locale }: { rows: SubscriptionRow[]; locale: string }) {
  return (
    <DataTable<SubscriptionRow>
      label="Subscriptions"
      rows={rows}
      rowKey={(s) => s.id}
      empty="No subscriptions yet."
      columns={[
        {
          key: 'date',
          header: 'Started',
          cell: (s) => date(s.createdAt, locale),
          sortValue: (s) => s.createdAt.getTime(),
        },
        { key: 'email', header: 'Email', cell: (s) => s.email, sortValue: (s) => s.email },
        { key: 'offer', header: 'Offer', cell: (s) => s.offerTitle },
        { key: 'terms', header: 'Price', cell: (s) => priceTermsLabel(s.terms, locale) },
        {
          key: 'status',
          header: 'Status',
          cell: (s) => (
            <Inline gap="tight">
              <span>{subscriptionStatusLabel(s.status)}</span>
              {s.livemode ? null : <Badge tone="warning">Test</Badge>}
            </Inline>
          ),
          sortValue: (s) => s.status,
        },
        { key: 'payments', header: 'Payments', cell: payments, sortValue: (s) => s.paymentsMade },
        { key: 'until', header: 'Paid until', cell: (s) => date(s.endedAt ?? s.currentPeriodEnd, locale) },
      ]}
    />
  );
}
