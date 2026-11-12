'use client';
// Studio > Customers: orders, subscriptions (G5) + contacts (G16). Client: DataTable takes cell functions.
import { ButtonLink } from '@/components/ui/links';
import { Badge, DataTable, Heading, Inline, Stack } from '@/components/ui/mds';
import { formatMoney } from '@/lib/commerce/money';
import type { Contact } from '@/lib/data/types';
import type { CustomerOrder, CustomersView } from '../../api/customers';
import { contactsCsvHref } from '../../paths';
import { SubscriptionsTable } from './SubscriptionsTable';

const date = (d: Date | null, locale: string) => (d ? d.toLocaleDateString(locale) : '');

export function CustomersTables({ view, locale }: { view: CustomersView; locale: string }) {
  return (
    <Stack gap="loose">
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Orders
        </Heading>
        <DataTable<CustomerOrder>
          label="Orders"
          rows={view.orders}
          rowKey={(o) => o.id}
          empty="No orders yet."
          columns={[
            { key: 'date', header: 'Date', cell: (o) => date(o.createdAt, locale), sortValue: (o) => o.createdAt.getTime() },
            { key: 'email', header: 'Email', cell: (o) => o.email, sortValue: (o) => o.email },
            { key: 'offer', header: 'Offer', cell: (o) => o.offerTitle },
            { key: 'amount', header: 'Amount', cell: (o) => formatMoney(o.amountCents, o.currency, locale), sortValue: (o) => o.amountCents },
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
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Subscriptions
        </Heading>
        <SubscriptionsTable rows={view.subscriptions} locale={locale} />
      </Stack>
      <Stack gap="base">
        <Inline gap="base">
          <Heading level={2} variant="subtitle">
            Contacts
          </Heading>
          <ButtonLink href={contactsCsvHref} variant="secondary">
            Export CSV
          </ButtonLink>
        </Inline>
        <DataTable<Contact>
          label="Contacts"
          rows={view.contacts}
          rowKey={(c) => c.email}
          empty="No contacts yet."
          columns={[
            { key: 'email', header: 'Email', cell: (c) => c.email, sortValue: (c) => c.email },
            { key: 'consent', header: 'Marketing consent', cell: (c) => (c.marketingConsent ? 'Yes' : 'No') },
            { key: 'source', header: 'Source', cell: (c) => c.consentSource ?? '' },
            { key: 'added', header: 'Added', cell: (c) => date(c.createdAt, locale), sortValue: (c) => c.createdAt.getTime() },
          ]}
        />
      </Stack>
    </Stack>
  );
}
