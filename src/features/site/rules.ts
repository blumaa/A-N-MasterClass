// Site rules shared by the DAL and the Studio editors.
import { LEGAL_KINDS, type LegalKind, type NavItem, type Page } from '@/lib/data/types';
import { isSafeHref } from '@/lib/site/sections';

/** Page slugs that would be shadowed by app routes (rules.test.ts checks app/[space]). */
export const RESERVED_PAGE_SLUGS: readonly string[] = ['blog', 'checkout', 'claim', 'dev', 'library', 'programs', 'studio', 'api', 'manifest.webmanifest'];

export const LEGAL_LABELS: Readonly<Record<LegalKind, string>> = {
  imprint: 'Legal notice',
  privacy: 'Privacy policy',
  terms: 'Terms',
};

/** Legal kinds still missing a published page (G25: required before the home page goes live). */
export function legalGaps(pages: readonly Pick<Page, 'legalKind' | 'published'>[]): LegalKind[] {
  const live = new Set(pages.filter((p) => p.published !== null).map((p) => p.legalKind));
  return LEGAL_KINDS.filter((kind) => !live.has(kind));
}

export const MAX_NAV_ITEMS = 12;

export type NavCheck = { ok: true; items: NavItem[] } | { ok: false; message: string };

export function checkNav(rows: readonly NavItem[]): NavCheck {
  const items = rows.map((r) => ({ label: r.label.trim(), href: r.href.trim() })).filter((r) => r.label || r.href);
  if (items.length > MAX_NAV_ITEMS) return { ok: false, message: `At most ${MAX_NAV_ITEMS} links.` };
  for (const [i, item] of items.entries()) {
    if (!item.label || !item.href) return { ok: false, message: `Link ${i + 1} needs a label and a link.` };
    if (!isSafeHref(item.href)) return { ok: false, message: `Link ${i + 1} must start with / or https://.` };
  }
  return { ok: true, items };
}
