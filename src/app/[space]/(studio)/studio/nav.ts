// Studio side nav SSOT: one entry per section, gated by capability (G15).
// The layout renders it; /studio redirects viewers without programs access to the first entry.
import { studioCustomersHref, studioOffersHref, studioPaymentsHref } from '@/features/checkout/paths';
import { studioCoachingHref } from '@/features/coaching/paths';
import { studioCommunitiesHref } from '@/features/community/paths';
import { studioDownloadsHref } from '@/features/downloads/paths';
import { studioPodcastsHref } from '@/features/podcasts/paths';
import { studioSiteHref } from '@/features/site/paths';
import { studioBrandingHref, studioHref } from '@/features/studio/paths';
import { can, type Capability } from '@/lib/auth/capabilities';
import type { Role } from '@/lib/data/types';

type NavItem = { href: string; label: string; cap: Capability };

const NAV: readonly NavItem[] = [
  { href: studioHref, label: 'Programs', cap: 'products.edit' },
  { href: studioCommunitiesHref, label: 'Communities', cap: 'products.edit' },
  { href: studioCoachingHref, label: 'Coaching', cap: 'products.edit' },
  { href: studioPodcastsHref, label: 'Podcasts', cap: 'products.edit' },
  { href: studioDownloadsHref, label: 'Downloads', cap: 'products.edit' },
  { href: studioSiteHref, label: 'Site', cap: 'site.edit' },
  { href: studioBrandingHref, label: 'Branding', cap: 'branding.manage' },
  { href: studioOffersHref, label: 'Offers', cap: 'offers.manage' },
  { href: studioCustomersHref, label: 'Customers', cap: 'customers.manage' },
  { href: studioPaymentsHref, label: 'Payments', cap: 'payments.manage' },
];

export const studioNav = (role: Role | null): NavItem[] => (role ? NAV.filter((i) => can(role, i.cap)) : []);
