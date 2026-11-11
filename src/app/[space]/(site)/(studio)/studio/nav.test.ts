import { describe, expect, it } from 'vitest';
import type { Role } from '@/lib/data/types';
import { studioNav } from './nav';

const labels = (role: Role) => studioNav(role).map((i) => i.label);

describe('studioNav', () => {
  it('shows each section only to roles with its capability (G15)', () => {
    expect(labels('owner')).toEqual(['Programs', 'Communities', 'Coaching', 'Podcasts', 'Downloads', 'Site', 'Branding', 'Offers', 'Customers', 'Payments']);
    expect(labels('admin')).toEqual(['Programs', 'Communities', 'Coaching', 'Podcasts', 'Downloads', 'Site', 'Branding', 'Offers', 'Customers']);
    expect(labels('assistant')).toEqual(['Programs', 'Communities', 'Coaching', 'Podcasts', 'Downloads', 'Site']);
    expect(labels('support')).toEqual(['Customers']);
  });

  it('first item is where /studio sends a viewer without programs access', () => {
    expect(studioNav('support')[0]?.href).toBe('/studio/customers');
  });
});
