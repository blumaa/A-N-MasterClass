// Supabase Repo: site builder pages, publish versions, header/footer nav.
// Semantics mirror src/lib/data/fake/fakeSiteRepo.ts; constraints come from the SQL schema.
// Everything runs as the caller (RLS: site.edit); no method needs admin().
import type { Json } from '@/lib/db/database.types';
import type { Repo } from '@/lib/data/repo';
import { check, defined, isoOrNull, unwrap, unwrapMaybe, type RepoCtx } from './context';
import { toPage, toPageVersion, toSiteNav } from './mapSite';

export type SiteRepo = Pick<
  Repo,
  | 'pages'
  | 'page'
  | 'pageBySlug'
  | 'createPage'
  | 'updatePage'
  | 'deletePage'
  | 'pageVersions'
  | 'addPageVersion'
  | 'siteNav'
  | 'saveSiteNav'
>;

export function createSiteRepo({ db }: RepoCtx): SiteRepo {
  return {
    async pages(spaceId) {
      const rows = unwrap(await (await db()).from('pages').select('*').eq('space_id', spaceId));
      // Sorted here, not in SQL, so the order matches the fake (localeCompare), not the DB collation.
      return rows.map(toPage).toSorted((a, b) => a.title.localeCompare(b.title));
    },
    async page(id) {
      const row = unwrapMaybe(await (await db()).from('pages').select('*').eq('id', id).maybeSingle());
      return row && toPage(row);
    },
    async pageBySlug(spaceId, kind, slug) {
      const row = unwrapMaybe(
        await (await db()).from('pages').select('*').eq('space_id', spaceId).eq('kind', kind).eq('slug', slug).maybeSingle(),
      );
      return row && toPage(row);
    },

    async createPage(input) {
      const row = unwrap(
        await (await db())
          .from('pages')
          .insert({ space_id: input.spaceId, kind: input.kind, slug: input.slug, title: input.title })
          .select('*')
          .single(),
      );
      return toPage(row);
    },
    async updatePage(id, patch) {
      const row = unwrapMaybe(
        await (await db())
          .from('pages')
          .update({
            ...defined({
              slug: patch.slug,
              title: patch.title,
              is_home: patch.isHome,
              legal_kind: patch.legalKind,
              seo_title: patch.seoTitle,
              seo_description: patch.seoDescription,
              draft: patch.draft as unknown as Json | undefined,
              published: patch.published as unknown as Json | null | undefined,
              published_at: isoOrNull(patch.publishedAt),
            }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .maybeSingle(),
      );
      if (!row) throw new Error('page not found');
      return toPage(row);
    },
    async deletePage(id) {
      // Versions go with the page (FK on delete cascade).
      check(await (await db()).from('pages').delete().eq('id', id));
    },

    async pageVersions(pageId) {
      const rows = unwrap(
        await (await db()).from('page_versions').select('*').eq('page_id', pageId).order('published_at', { ascending: false }),
      );
      return rows.map(toPageVersion);
    },
    async addPageVersion(input) {
      const row = unwrap(
        await (await db())
          .from('page_versions')
          .insert({
            page_id: input.pageId,
            sections: input.sections as unknown as Json,
            published_at: input.publishedAt.toISOString(),
          })
          .select('*')
          .single(),
      );
      return toPageVersion(row);
    },

    async siteNav(spaceId) {
      const row = unwrapMaybe(await (await db()).from('site_nav').select('*').eq('space_id', spaceId).maybeSingle());
      return row ? toSiteNav(row) : { spaceId, header: [], footer: [] };
    },
    async saveSiteNav(nav) {
      const row = unwrap(
        await (await db())
          .from('site_nav')
          .upsert(
            {
              space_id: nav.spaceId,
              header: nav.header as unknown as Json,
              footer: nav.footer as unknown as Json,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'space_id' },
          )
          .select('*')
          .single(),
      );
      return toSiteNav(row);
    },
  };
}
