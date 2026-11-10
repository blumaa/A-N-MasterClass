import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomersTables } from './CustomersTables';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('CustomersTables', () => {
  it('lists orders (test orders flagged) and contacts with consent', () => {
    render(
      <CustomersTables
        locale="en"
        view={{
          orders: [{ id: 'r1', email: 'b@test', offerTitle: 'Full', amountCents: 4900, currency: 'EUR', status: 'paid', livemode: false, createdAt: NOW }],
          contacts: [{ spaceId: 's', email: 'b@test', profileId: null, marketingConsent: true, consentAt: NOW, consentSource: 'checkout', createdAt: NOW }],
        }}
      />,
    );
    const orders = screen.getByRole('table', { name: 'Orders' });
    expect(orders).toHaveTextContent('Full');
    expect(orders).toHaveTextContent('€49.00');
    expect(orders).toHaveTextContent('Test');
    expect(screen.getByRole('table', { name: 'Contacts' })).toHaveTextContent('Yes');
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', '/studio/customers/contacts.csv');
  });
});
