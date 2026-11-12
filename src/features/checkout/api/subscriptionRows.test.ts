import { describe, expect, it } from 'vitest';
import type { Offer, Subscription } from '@/lib/data/types';
import { subscriptionRows } from './subscriptionRows';

const NOW = new Date('2026-11-10T12:00:00Z');

const sub = (extra: Partial<Subscription>): Subscription => ({
  id: 'sub-1',
  spaceId: 's1',
  offerId: 'o1',
  profileId: 'p1',
  email: 'buyer@test.com',
  kind: 'subscription',
  provider: 'fake',
  providerSubscriptionId: 'FAKE-SUB-1',
  status: 'active',
  amountCents: 1500,
  currency: 'EUR',
  billingInterval: 'month',
  trialDays: null,
  installments: null,
  paymentsMade: 1,
  currentPeriodEnd: NOW,
  endedAt: null,
  livemode: true,
  waiverVersion: 'v1',
  waiverAcceptedAt: NOW,
  marketingConsent: false,
  createdAt: NOW,
  ...extra,
});

const offers = [{ id: 'o1', title: 'Monthly' }] as Offer[];

describe('subscriptionRows', () => {
  it('adds the offer title and the billed terms from the subscription, not the offer', () => {
    const [row] = subscriptionRows([sub({ amountCents: 900 })], offers);
    expect(row).toMatchObject({
      id: 'sub-1',
      email: 'buyer@test.com',
      offerTitle: 'Monthly',
      status: 'active',
      terms: {
        kind: 'subscription',
        priceCents: 900,
        currency: 'EUR',
        billingInterval: 'month',
        trialDays: null,
        installments: null,
      },
      currentPeriodEnd: NOW,
      livemode: true,
    });
  });

  it('only active or past due subscriptions can be cancelled by the member; payment plans never', () => {
    const rows = subscriptionRows(
      [
        sub({ id: 'a', status: 'past_due' }),
        sub({ id: 'b', status: 'cancelled' }),
        sub({ id: 'c', kind: 'payment_plan', installments: 3 }),
        sub({ id: 'd', status: 'pending' }),
      ],
      offers,
    );
    expect(rows.map((r) => [r.id, r.cancellable])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
      ['d', false],
    ]);
  });
});
