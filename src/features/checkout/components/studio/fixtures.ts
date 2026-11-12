import type { Coupon, Offer } from '@/lib/data/types';

export const offer = (over: Partial<Offer> = {}): Offer => ({
  id: 'o1',
  spaceId: 's',
  slug: 'full',
  title: 'Full access',
  description: null,
  priceCents: 4995,
  currency: 'EUR',
  status: 'draft',
  bumpOfferId: null,
  upsellOfferId: null,
  kind: 'one_time',
  billingInterval: null,
  trialDays: null,
  installments: null,
  ...over,
});

export const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: 'c1',
  spaceId: 's',
  code: 'SAVE10',
  percentOff: 10,
  amountOffCents: null,
  currency: null,
  maxUses: null,
  oncePerCustomer: false,
  expiresAt: null,
  active: true,
  offerIds: ['o1'],
  createdAt: new Date('2026-11-01T00:00:00Z'),
  ...over,
});
