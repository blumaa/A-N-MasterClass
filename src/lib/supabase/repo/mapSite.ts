// Row (snake_case, ISO strings, jsonb) -> domain type. Site tables only.
// jsonb shapes are guarded by SQL checks (is_site_sections, is_nav_items), so the casts trust the DB.
import type { LegalKind, NavItem, Page, PageKind, PageVersion, PublishedPage, SiteNav } from '@/lib/data/types';
import type { SiteSection } from '@/lib/site/sections';
import { present, toDate, toDateOrNull, type Row, type ViewRow } from './context';

export const toPage = (r: Row<'pages'>): Page => ({
  id: r.id,
  spaceId: r.space_id,
  kind: r.kind as PageKind,
  slug: r.slug,
  title: r.title,
  isHome: r.is_home,
  legalKind: r.legal_kind as LegalKind | null,
  seoTitle: r.seo_title,
  seoDescription: r.seo_description,
  draft: r.draft as unknown as SiteSection[],
  published: r.published as unknown as SiteSection[] | null,
  publishedAt: toDateOrNull(r.published_at),
  updatedAt: toDate(r.updated_at),
});

export const toPublishedPage = (r: ViewRow<'published_pages'>): PublishedPage => ({
  id: present(r.id, 'id'),
  spaceId: present(r.space_id, 'space_id'),
  kind: present(r.kind, 'kind') as PageKind,
  slug: present(r.slug, 'slug'),
  title: present(r.title, 'title'),
  isHome: present(r.is_home, 'is_home'),
  legalKind: r.legal_kind as LegalKind | null,
  seoTitle: r.seo_title,
  seoDescription: r.seo_description,
  published: present(r.published, 'published') as unknown as SiteSection[],
  publishedAt: toDateOrNull(r.published_at),
});

export const toPageVersion = (r: Row<'page_versions'>): PageVersion => ({
  id: r.id,
  pageId: r.page_id,
  sections: r.sections as unknown as SiteSection[],
  publishedAt: toDate(r.published_at),
});

export const toSiteNav = (r: Row<'site_nav'>): SiteNav => ({
  spaceId: r.space_id,
  header: r.header as unknown as NavItem[],
  footer: r.footer as unknown as NavItem[],
});
