// Site part of the fake repo. Same constraints as supabase/migrations/*_site.sql:
// unique (space_id, kind, slug), one home page and one page per legal kind per space, home is a page, versions cascade.
import { SLUG_PATTERN } from '@/lib/tenancy/slug';
import { ConstraintError } from '../errors';
import type { Repo } from '../repo';
import type { Page, PublishedPage } from '../types';
import type { Db } from './db';

type SiteRepo = Pick<
  Repo,
  | 'pages'
  | 'page'
  | 'pageBySlug'
  | 'publishedPages'
  | 'publishedPage'
  | 'createPage'
  | 'updatePage'
  | 'deletePage'
  | 'pageVersions'
  | 'addPageVersion'
  | 'siteNav'
  | 'saveSiteNav'
>;

function checkUnique(db: Db, row: Page): void {
  if (!SLUG_PATTERN.test(row.slug)) throw new ConstraintError(`invalid slug: ${JSON.stringify(row.slug)}`);
  const others = db.pages.filter((p) => p.spaceId === row.spaceId && p.id !== row.id);
  if (others.some((p) => p.kind === row.kind && p.slug === row.slug)) throw new ConstraintError(`slug taken: ${row.slug}`);
  if (row.isHome && row.kind !== 'page') throw new ConstraintError('home must be a page');
  if (row.isHome && others.some((p) => p.isHome)) throw new ConstraintError('space already has a home page');
  if (row.legalKind && others.some((p) => p.legalKind === row.legalKind)) throw new ConstraintError(`legal page taken: ${row.legalKind}`);
}

/** Mirrors view published_pages: published rows only, without draft and updatedAt. */
function toPublished(p: Page): PublishedPage[] {
  if (!p.published) return [];
  const { draft: _draft, updatedAt: _updatedAt, ...rest } = p;
  return [{ ...rest, published: p.published }];
}

export function createFakeSiteRepo(db: Db, id: (prefix: string) => string): SiteRepo {
  const find = (pid: string): Page => {
    const row = db.pages.find((p) => p.id === pid);
    if (!row) throw new Error('page not found');
    return row;
  };

  return {
    pages: async (spaceId) =>
      db.pages.filter((p) => p.spaceId === spaceId).toSorted((a, b) => a.title.localeCompare(b.title)),
    page: async (pid) => db.pages.find((p) => p.id === pid) ?? null,
    pageBySlug: async (spaceId, kind, slug) =>
      db.pages.find((p) => p.spaceId === spaceId && p.kind === kind && p.slug === slug) ?? null,
    publishedPages: async (spaceId) =>
      db.pages
        .filter((p) => p.spaceId === spaceId)
        .flatMap(toPublished)
        .toSorted((a, b) => a.title.localeCompare(b.title)),
    publishedPage: async (spaceId, kind, slug) =>
      db.pages.filter((p) => p.spaceId === spaceId && p.kind === kind && p.slug === slug).flatMap(toPublished)[0] ?? null,

    async createPage(input) {
      const row: Page = {
        ...input,
        id: id('page'),
        isHome: false,
        legalKind: null,
        seoTitle: null,
        seoDescription: null,
        draft: [],
        published: null,
        publishedAt: null,
        updatedAt: new Date(),
      };
      checkUnique(db, row);
      db.pages.push(row);
      return row;
    },
    async updatePage(pid, patch) {
      const row = find(pid);
      const next = { ...row, ...patch, updatedAt: new Date() };
      checkUnique(db, next);
      return Object.assign(row, next);
    },
    async deletePage(pid) {
      db.pages = db.pages.filter((p) => p.id !== pid);
      db.pageVersions = db.pageVersions.filter((v) => v.pageId !== pid);
    },

    pageVersions: async (pageId) =>
      db.pageVersions
        .filter((v) => v.pageId === pageId)
        .toSorted((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()),
    async addPageVersion(input) {
      find(input.pageId);
      const row = { ...input, id: id('pver') };
      db.pageVersions.push(row);
      return row;
    },

    siteNav: async (spaceId) => db.siteNav.find((n) => n.spaceId === spaceId) ?? { spaceId, header: [], footer: [] },
    async saveSiteNav(nav) {
      db.siteNav = [...db.siteNav.filter((n) => n.spaceId !== nav.spaceId), nav];
      return nav;
    },
  };
}
