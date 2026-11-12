import { beforeEach, describe, expect, it } from 'vitest';
import { newSection } from '@/lib/site/sections';
import { emptyDb } from './db';
import { createFakeRepo, type FakeRepo } from './fakeRepo';

let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push(
    { id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false },
    { id: 's2', slug: 'natasha', name: 'Natasha', status: 'live', locale: 'en', isTest: false },
  );
});

const page = (slug = 'about', spaceId = 's1', kind: 'page' | 'post' = 'page') =>
  repo.createPage({ spaceId, kind, slug, title: 'About' });

describe('published pages (visitor reads)', () => {
  it('lists only published pages of the space, without drafts, by title', async () => {
    const live = await page('about');
    await page('draft-only');
    await page('other', 's2');
    const sections = [newSection('text', 't1')];
    await repo.updatePage(live.id, { draft: [newSection('text', 'd1')], published: sections, publishedAt: new Date('2026-01-01T00:00:00Z') });
    const list = await repo.publishedPages('s1');
    expect(list.map((p) => p.slug)).toEqual(['about']);
    expect(list[0]).toMatchObject({ published: sections, publishedAt: new Date('2026-01-01T00:00:00Z') });
    expect(list[0]).not.toHaveProperty('draft');
  });

  it('finds one published page by kind and slug', async () => {
    const live = await page('about');
    await page('hidden');
    await repo.updatePage(live.id, { published: [], publishedAt: new Date() });
    expect((await repo.publishedPage('s1', 'page', 'about'))?.id).toBe(live.id);
    expect(await repo.publishedPage('s1', 'post', 'about')).toBeNull();
    expect(await repo.publishedPage('s1', 'page', 'hidden')).toBeNull();
    expect(await repo.publishedPage('s2', 'page', 'about')).toBeNull();
  });
});

describe('pages', () => {
  it('starts as an unpublished draft with no sections', async () => {
    const p = await page();
    expect(p).toMatchObject({ isHome: false, legalKind: null, draft: [], published: null, publishedAt: null });
    expect(await repo.pages('s1')).toHaveLength(1);
    expect(await repo.pages('s2')).toHaveLength(0);
  });

  it('keeps slugs unique per space and kind (unique space_id, kind, slug)', async () => {
    await page('about');
    await expect(page('about')).rejects.toThrow(/slug/);
    await expect(page('about', 's2')).resolves.toBeTruthy();
    await expect(page('about', 's1', 'post')).resolves.toBeTruthy();
    const other = await page('contact');
    await expect(repo.updatePage(other.id, { slug: 'about' })).rejects.toThrow(/slug/);
  });

  it('refuses an invalid slug', async () => {
    await expect(page('Not Valid')).rejects.toThrow(/slug/);
  });

  it('finds by space, kind and slug', async () => {
    const p = await page('about');
    expect(await repo.pageBySlug('s1', 'page', 'about')).toEqual(p);
    expect(await repo.pageBySlug('s1', 'post', 'about')).toBeNull();
    expect(await repo.pageBySlug('s2', 'page', 'about')).toBeNull();
  });

  it('allows one home per space, pages only', async () => {
    const a = await page('a');
    const b = await page('b');
    await repo.updatePage(a.id, { isHome: true });
    await expect(repo.updatePage(b.id, { isHome: true })).rejects.toThrow(/home/);
    const post = await page('p', 's1', 'post');
    await repo.updatePage(a.id, { isHome: false });
    await expect(repo.updatePage(post.id, { isHome: true })).rejects.toThrow(/home/);
  });

  it('allows one page per legal kind per space', async () => {
    const a = await page('a');
    const b = await page('b');
    await repo.updatePage(a.id, { legalKind: 'privacy' });
    await expect(repo.updatePage(b.id, { legalKind: 'privacy' })).rejects.toThrow(/legal/);
    await expect(repo.updatePage(b.id, { legalKind: 'terms' })).resolves.toBeTruthy();
  });

  it('bumps updatedAt on update', async () => {
    const p = await page();
    const before = p.updatedAt.getTime();
    const updated = await repo.updatePage(p.id, { title: 'New', draft: [newSection('text', 't1')] });
    expect(updated.title).toBe('New');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('deletes versions with the page', async () => {
    const p = await page();
    await repo.addPageVersion({ pageId: p.id, sections: [], publishedAt: new Date() });
    await repo.deletePage(p.id);
    expect(await repo.page(p.id)).toBeNull();
    expect(repo.db.pageVersions).toEqual([]);
  });
});

describe('page versions', () => {
  it('lists newest first', async () => {
    const p = await page();
    await repo.addPageVersion({ pageId: p.id, sections: [], publishedAt: new Date('2026-01-01') });
    await repo.addPageVersion({ pageId: p.id, sections: [newSection('text', 't')], publishedAt: new Date('2026-02-01') });
    const list = await repo.pageVersions(p.id);
    expect(list.map((v) => v.publishedAt.toISOString().slice(0, 7))).toEqual(['2026-02', '2026-01']);
  });
});

describe('site nav', () => {
  it('is empty until saved, then upserts per space', async () => {
    expect(await repo.siteNav('s1')).toEqual({ spaceId: 's1', header: [], footer: [] });
    const nav = { spaceId: 's1', header: [{ label: 'About', href: '/about' }], footer: [] };
    await repo.saveSiteNav(nav);
    await repo.saveSiteNav({ ...nav, footer: [{ label: 'Blog', href: '/blog' }] });
    expect((await repo.siteNav('s1')).footer).toHaveLength(1);
    expect(repo.db.siteNav).toHaveLength(1);
    expect((await repo.siteNav('s2')).header).toEqual([]);
  });
});
