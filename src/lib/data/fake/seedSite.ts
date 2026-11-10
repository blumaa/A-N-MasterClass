// Dev site content for DATA_SOURCE=fake: home pages, legal pages, a draft page, a blog post
// and header/footer links. Kept out of seedDb so DAL tests start from an empty site.
import type { Page } from '@/lib/data/types';
import type { SiteSection } from '@/lib/site/sections';
import type { Db } from './db';
import { SEED_IDS } from './seed';

const DAY = 86_400_000;

const section = (id: string, kind: SiteSection['kind'], fields: Record<string, string>, items: Record<string, string>[] = []): SiteSection => ({
  id,
  kind,
  hidden: false,
  fields,
  items,
});

type Draft = Pick<Page, 'id' | 'spaceId' | 'slug' | 'title'> & Partial<Page>;

function page(d: Draft, sections: SiteSection[], publishedAt: Date | null): Page {
  return {
    kind: 'page',
    isHome: false,
    legalKind: null,
    seoTitle: null,
    seoDescription: null,
    draft: sections,
    published: publishedAt ? sections : null,
    publishedAt,
    updatedAt: publishedAt ?? new Date(0),
    ...d,
  };
}

const LEGAL = [
  { kind: 'imprint', slug: 'legal-notice', title: 'Legal notice' },
  { kind: 'privacy', slug: 'privacy', title: 'Privacy policy' },
  { kind: 'terms', slug: 'terms', title: 'Terms' },
] as const;

function legalPages(spaceId: string, at: Date): Page[] {
  return LEGAL.map(({ kind, slug, title }) =>
    page(
      { id: `page-${spaceId}-${slug}`, spaceId, slug, title, legalKind: kind },
      [section(`sec-${spaceId}-${slug}`, 'text', { heading: '', body: `Placeholder ${title.toLowerCase()} text. Replace with the text from your lawyer.` })],
      at,
    ),
  );
}

export function seedSite(db: Db, now: Date = new Date()): Db {
  const ids = SEED_IDS;
  const at = new Date(now.getTime() - 7 * DAY);

  db.pages.push(
    page(
      { id: 'page-alexander-home', spaceId: ids.alexander, slug: 'home', title: 'Home', isHome: true, seoTitle: 'Alexander — rope classes online' },
      [
        section('sec-a-hero', 'hero', {
          heading: 'Learn rope, one knot at a time',
          subheading: 'Online classes for beginners and returning students.',
          ctaLabel: 'See the programs',
          ctaHref: '/library',
        }),
        section('sec-a-curriculum', 'curriculum', { heading: 'Inside Shibari 101', programSlug: 'shibari-101' }),
        section('sec-a-quotes', 'testimonials', { heading: 'Students say' }, [
          { quote: 'Clear, calm and safe. I finally get it.', name: 'Ana' },
          { quote: 'The safety module alone was worth it.', name: 'Ben' },
        ]),
        section('sec-a-faq', 'faq', { heading: 'Questions' }, [
          { question: 'Do I need experience?', answer: 'No. Shibari 101 starts from zero.' },
          { question: 'How long do I keep access?', answer: 'For as long as the class exists.' },
        ]),
        section('sec-a-cta', 'cta', { heading: 'Ready to start?', body: '', ctaLabel: 'Open the library', ctaHref: '/library' }),
      ],
      at,
    ),
    page(
      { id: 'page-alexander-about', spaceId: ids.alexander, slug: 'about', title: 'About' },
      [section('sec-a-about', 'text', { heading: 'About Alexander', body: 'Draft bio. Not published yet.' })],
      null,
    ),
    page(
      {
        id: 'post-alexander-welcome',
        spaceId: ids.alexander,
        kind: 'post',
        slug: 'welcome',
        title: 'Welcome to the new site',
        seoDescription: 'Why the classes moved here and what is next.',
      },
      [section('sec-a-post', 'text', { heading: '', body: 'The classes have a new home. More soon.' })],
      at,
    ),
    page(
      { id: 'page-natasha-home', spaceId: ids.natasha, slug: 'home', title: 'Home', isHome: true },
      [section('sec-n-hero', 'hero', { heading: 'Natasha teaches', subheading: 'Movement and rope.', ctaLabel: '', ctaHref: '' })],
      at,
    ),
    ...legalPages(ids.alexander, at),
    ...legalPages(ids.natasha, at),
  );
  db.pageVersions.push(
    ...db.pages
      .filter((p) => p.published && p.publishedAt)
      .map((p) => ({ id: `ver-${p.id}`, pageId: p.id, sections: p.published!, publishedAt: p.publishedAt! })),
  );
  db.siteNav.push(
    { spaceId: ids.alexander, header: [{ label: 'Blog', href: '/blog' }], footer: [{ label: 'Blog', href: '/blog' }] },
    { spaceId: ids.natasha, header: [], footer: [] },
  );
  return db;
}
