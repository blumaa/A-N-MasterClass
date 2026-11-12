import { describe, expect, it } from 'vitest';
import type { Role } from '@/lib/data/types';
import { activeNavHref, studioNav } from './nav';

const labels = (role: Role) => studioNav(role).map((i) => i.label);

describe('studioNav', () => {
  it('shows each section only to roles with its capability (G15)', () => {
    expect(labels('owner')).toEqual(['Programs', 'Communities', 'Coaching', 'Podcasts', 'Downloads', 'Site', 'Branding', 'Offers', 'Coupons', 'Customers', 'Payments']);
    expect(labels('admin')).toEqual(['Programs', 'Communities', 'Coaching', 'Podcasts', 'Downloads', 'Site', 'Branding', 'Offers', 'Coupons', 'Customers']);
    expect(labels('assistant')).toEqual(['Programs', 'Communities', 'Coaching', 'Podcasts', 'Downloads', 'Site']);
    expect(labels('support')).toEqual(['Customers']);
  });

  it('first item is where /studio sends a viewer without programs access', () => {
    expect(studioNav('support')[0]?.href).toBe('/studio/customers');
  });
});

describe('activeNavHref', () => {
  const hrefs = studioNav('owner').map((i) => i.href);

  it('marks the section the path is in, longest match first', () => {
    expect(activeNavHref('/studio/branding', hrefs)).toBe('/studio/branding');
    expect(activeNavHref('/studio/offers/o1', hrefs)).toBe('/studio/offers');
    expect(activeNavHref('/studio', hrefs)).toBe('/studio');
    expect(activeNavHref('/studio/programs/p1', hrefs)).toBe('/studio');
  });

  it('matches whole path segments only', () => {
    expect(activeNavHref('/studio/sitemap', ['/studio/site'])).toBeNull();
  });
});
