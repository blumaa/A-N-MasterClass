import type { Offer } from '@/lib/data/types';

export const offer = (over: Partial<Offer> = {}): Offer => ({
  id: 'o1',
  spaceId: 's',
  slug: 'full',
  title: 'Full access',
  description: null,
  priceCents: 4995,
  currency: 'EUR',
  status: 'draft',
  ...over,
});
