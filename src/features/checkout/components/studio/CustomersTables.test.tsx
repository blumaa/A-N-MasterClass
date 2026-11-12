import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomersTables } from './CustomersTables';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('CustomersTables', () => {
  it('lists orders (test orders flagged), subscriptions and contacts with consent', () => {
    render(
      <CustomersTables
        locale="en"
        view={{
          orders: [{ id: 'r1', email: 'b@test', offerTitle: 'Full', amountCents: 4900, currency: 'EUR', status: 'paid', livemode: false, createdAt: NOW }],
          subscriptions: [
            {
              id: 's1',
              email: 'sub@test',
              offerTitle: 'Plan',
              terms: { kind: 'payment_plan', priceCents: 5000, currency: 'EUR', billingInterval: 'month', trialDays: null, installments: 3 },
              status: 'past_due',
              paymentsMade: 1,
              currentPeriodEnd: NOW,
              endedAt: null,
              livemode: true,
              createdAt: NOW,
              cancellable: false,
            },
          ],
          contacts: [{ spaceId: 's', email: 'b@test', profileId: null, marketingConsent: true, consentAt: NOW, consentSource: 'checkout', createdAt: NOW }],
        }}
      />,
    );
    const orders = screen.getByRole('table', { name: 'Orders' });
    expect(orders).toHaveTextContent('Full');
    expect(orders).toHaveTextContent('€49.00');
    expect(orders).toHaveTextContent('Test');
    const subs = screen.getByRole('table', { name: 'Subscriptions' });
    expect(subs).toHaveTextContent('3 monthly payments of €50.00');
    expect(subs).toHaveTextContent('past due');
    expect(subs).toHaveTextContent('1 of 3');
    expect(screen.getByRole('table', { name: 'Contacts' })).toHaveTextContent('Yes');
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', '/studio/customers/contacts.csv');
  });
});
