// Site Supabase repo against the linked project, as the service client (RLS is covered by the SQL suites).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConstraintError } from '@/lib/data/errors';
import type { PageKind } from '@/lib/data/types';
import { newSection } from '@/lib/site/sections';
import { createSiteRepo, type SiteRepo } from './site';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

describe.skipIf(!contractEnabled)('site repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let repo: SiteRepo;
  let spaceId: string;
  let n = 0;
  const make = (title: string, kind: PageKind = 'page', slug = `p-${(n += 1)}`) =>
    repo.createPage({ spaceId, kind, slug, title });

  beforeAll(async () => {
    fx = await createContractSpace('site');
    spaceId = fx.spaceId;
    repo = createSiteRepo({ db: async () => fx.admin, admin: () => fx.admin });
  });
  afterAll(async () => {
    await fx?.cleanup();
  });

  it('creates with defaults and reads back by id and slug', async () => {
    const p = await repo.createPage({ spaceId, kind: 'page', slug: 'about', title: 'About' });
    expect(p).toMatchObject({ isHome: false, legalKind: null, seoTitle: null, seoDescription: null, draft: [], published: null, publishedAt: null });
    expect(p.updatedAt).toBeInstanceOf(Date);
    expect(await repo.page(p.id)).toEqual(p);
    expect(await repo.pageBySlug(spaceId, 'page', 'about')).toEqual(p);
    expect(await repo.pageBySlug(spaceId, 'post', 'about')).toBeNull();
    expect(await repo.page('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('lists pages ordered by title', async () => {
    await make('Zed');
    await make('Alpha');
    const titles = (await repo.pages(spaceId)).map((p) => p.title);
    expect(titles).toEqual(titles.toSorted((a, b) => a.localeCompare(b)));
    expect(titles).toContain('Alpha');
  });

  it('rejects duplicate slug per kind but allows the same slug across kinds', async () => {
    await make('One', 'page', 'dup');
    await expect(make('Two', 'page', 'dup')).rejects.toBeInstanceOf(ConstraintError);
    await expect(make('Post', 'post', 'dup')).resolves.toBeTruthy();
    const other = await make('Other');
    await expect(repo.updatePage(other.id, { slug: 'dup' })).rejects.toBeInstanceOf(ConstraintError);
  });

  it('rejects an invalid slug', async () => {
    await expect(make('Bad', 'page', 'Bad Slug')).rejects.toBeInstanceOf(ConstraintError);
  });

  it('updates fields, sets updatedAt, null-clears optional fields', async () => {
    const p = await make('Edit');
    const updated = await repo.updatePage(p.id, {
      title: 'New',
      seoTitle: 'S',
      draft: [newSection('text', 't1')],
      published: [newSection('text', 't1')],
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(updated).toMatchObject({ title: 'New', seoTitle: 'S', slug: p.slug });
    expect(updated.draft).toHaveLength(1);
    expect(updated.publishedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    // updatedAt is the app clock, the created default is the DB clock: allow skew.
    expect(updated.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime() - 5000);
    const cleared = await repo.updatePage(p.id, { seoTitle: null, published: null, publishedAt: null });
    expect(cleared).toMatchObject({ seoTitle: null, published: null, publishedAt: null, title: 'New' });
    expect(cleared.draft).toHaveLength(1);
  });

  it('throws on updating a missing page', async () => {
    await expect(repo.updatePage('00000000-0000-0000-0000-000000000000', { title: 'x' })).rejects.toThrow(/not found/);
  });

  it('allows one home per space, pages only', async () => {
    const a = await make('HomeA');
    const b = await make('HomeB');
    const post = await make('HomePost', 'post');
    await repo.updatePage(a.id, { isHome: true });
    await expect(repo.updatePage(b.id, { isHome: true })).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.updatePage(post.id, { isHome: true })).rejects.toBeInstanceOf(ConstraintError);
    await repo.updatePage(a.id, { isHome: false });
    await expect(repo.updatePage(b.id, { isHome: true })).resolves.toMatchObject({ isHome: true });
  });

  it('allows one page per legal kind per space', async () => {
    const a = await make('LegalA');
    const b = await make('LegalB');
    await repo.updatePage(a.id, { legalKind: 'privacy' });
    await expect(repo.updatePage(b.id, { legalKind: 'privacy' })).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.updatePage(b.id, { legalKind: 'terms' })).resolves.toBeTruthy();
  });

  it('deleting a page cascades to its versions', async () => {
    const p = await make('Gone');
    await repo.addPageVersion({ pageId: p.id, sections: [], publishedAt: new Date() });
    await repo.deletePage(p.id);
    expect(await repo.page(p.id)).toBeNull();
    expect(await repo.pageVersions(p.id)).toEqual([]);
  });

  it('lists versions newest first and rejects an unknown page', async () => {
    const p = await make('Versions');
    const old = await repo.addPageVersion({ pageId: p.id, sections: [], publishedAt: new Date('2026-01-01T00:00:00Z') });
    const recent = await repo.addPageVersion({
      pageId: p.id,
      sections: [newSection('text', 't')],
      publishedAt: new Date('2026-02-01T00:00:00Z'),
    });
    expect((await repo.pageVersions(p.id)).map((v) => v.id)).toEqual([recent.id, old.id]);
    expect(recent.sections).toHaveLength(1);
    expect(recent.publishedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    await expect(
      repo.addPageVersion({ pageId: '00000000-0000-0000-0000-000000000000', sections: [], publishedAt: new Date() }),
    ).rejects.toBeInstanceOf(ConstraintError);
  });

  it('nav: empty when none saved, upsert replaces', async () => {
    expect(await repo.siteNav(spaceId)).toEqual({ spaceId, header: [], footer: [] });
    const first = { spaceId, header: [{ label: 'Home', href: '/' }], footer: [] };
    expect(await repo.saveSiteNav(first)).toEqual(first);
    const second = { spaceId, header: [], footer: [{ label: 'Imprint', href: 'https://example.com/i' }] };
    expect(await repo.saveSiteNav(second)).toEqual(second);
    expect(await repo.siteNav(spaceId)).toEqual(second);
  });

  it('nav: rejects an unsafe href', async () => {
    await expect(
      repo.saveSiteNav({ spaceId, header: [{ label: 'X', href: 'javascript:alert(1)' }], footer: [] }),
    ).rejects.toBeInstanceOf(ConstraintError);
  });
});
