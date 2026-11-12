import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import type { LegalKind, Page } from '@/lib/data/types';
import type { SiteSection } from '@/lib/site/sections';
import {
  blogPosts,
  draftPreview,
  editSite,
  homePage,
  publicPage,
  publicPost,
  sectionChoices,
  sectionRefs,
  siteChrome,
  studioPage,
  studioSite,
  type SiteCommand,
} from './site';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let n = 0;
const newId = () => `sec-${++n}`;
const imageUrl = (path: string) => `https://cdn.test/${path}`;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
  n = 0;
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;
const owner = () => as(SEED_IDS.alexanderOwner);
const run = async (cmd: SiteCommand, viewer?: Viewer) => editSite(repo, viewer ?? (await owner()), cmd, NOW, newId);

async function offer(slug: string, status: 'draft' | 'published') {
  const o = await repo.createOffer({ spaceId: SEED_IDS.alexander, slug, title: slug === 'full' ? 'Full access' : slug, priceCents: 4900, currency: 'EUR' });
  return status === 'published' ? repo.updateOffer(o.id, { status }) : o;
}

async function create(title: string, slug: string, kind: Page['kind'] = 'page'): Promise<string> {
  const r = await run({ op: 'createPage', kind, title, slug });
  if (!r.ok || !r.id) throw new Error(JSON.stringify(r));
  return r.id;
}
const page = async (id: string) => (await repo.page(id))!;

async function withText(pageId: string, body = 'Hello'): Promise<SiteSection> {
  await run({ op: 'addSection', pageId, kind: 'text' });
  const section = (await page(pageId)).draft.at(-1)!;
  expect(await run({ op: 'updateSection', pageId, sectionId: section.id, fields: { heading: '', body }, items: [] })).toEqual({ ok: true });
  return (await page(pageId)).draft.at(-1)!;
}

async function settings(pageId: string, patch: Partial<{ isHome: boolean; legalKind: LegalKind | null; slug: string }>) {
  const p = await page(pageId);
  return run({
    op: 'updatePage',
    pageId,
    title: p.title,
    slug: patch.slug ?? p.slug,
    seoTitle: null,
    seoDescription: null,
    isHome: patch.isHome ?? p.isHome,
    legalKind: patch.legalKind === undefined ? p.legalKind : patch.legalKind,
  });
}

async function publishLegal() {
  for (const kind of ['imprint', 'privacy', 'terms'] as const) {
    const id = await create(kind, kind);
    await settings(id, { legalKind: kind });
    await withText(id);
    expect(await run({ op: 'publish', pageId: id })).toEqual({ ok: true });
  }
}

describe('capability + tenant wall', () => {
  it('lets site.edit roles in and keeps students out', async () => {
    expect((await run({ op: 'createPage', kind: 'page', title: 'A', slug: 'a' }, await as(SEED_IDS.assistant))).ok).toBe(true);
    expect(await run({ op: 'createPage', kind: 'page', title: 'B', slug: 'b' }, await as(SEED_IDS.student))).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(await studioSite(repo, await as(SEED_IDS.student))).toBeNull();
  });

  it('cannot touch a page of another space', async () => {
    const id = await create('About', 'about');
    const natasha = await as(SEED_IDS.natashaOwner, 'natasha');
    expect(await run({ op: 'deletePage', pageId: id }, natasha)).toEqual({ ok: false, error: 'not_found' });
    expect(await studioPage(repo, natasha, id)).toBeNull();
  });
});

describe('createPage / updatePage', () => {
  it('refuses reserved, malformed and duplicate slugs', async () => {
    expect(await run({ op: 'createPage', kind: 'page', title: 'S', slug: 'studio' })).toMatchObject({ error: 'invalid' });
    expect(await run({ op: 'createPage', kind: 'page', title: 'S', slug: 'Bad Slug' })).toMatchObject({ error: 'invalid' });
    await create('About', 'about');
    expect(await run({ op: 'createPage', kind: 'page', title: 'A2', slug: 'about' })).toMatchObject({ error: 'invalid' });
    // Posts live under /blog, so route names are fine there.
    expect((await run({ op: 'createPage', kind: 'post', title: 'Studio tour', slug: 'studio' })).ok).toBe(true);
  });

  it('moves the home flag from the old home page', async () => {
    const a = await create('A', 'a');
    const b = await create('B', 'b');
    await settings(a, { isHome: true });
    expect(await settings(b, { isHome: true })).toEqual({ ok: true });
    expect((await page(a)).isHome).toBe(false);
    expect((await page(b)).isHome).toBe(true);
  });

  it('refuses home or legal flags on a post', async () => {
    const p = await create('Post', 'post', 'post');
    expect(await settings(p, { isHome: true })).toMatchObject({ error: 'invalid' });
    expect(await settings(p, { legalKind: 'terms' })).toMatchObject({ error: 'invalid' });
  });

  it('refuses a second page of one legal kind', async () => {
    await settings(await create('P1', 'p1'), { legalKind: 'privacy' });
    expect(await settings(await create('P2', 'p2'), { legalKind: 'privacy' })).toMatchObject({ error: 'invalid' });
  });
});

describe('sections', () => {
  it('adds, edits, duplicates, hides, moves and removes', async () => {
    const id = await create('About', 'about');
    const first = await withText(id, 'One');
    expect(first.fields.body).toBe('One');
    await run({ op: 'duplicateSection', pageId: id, sectionId: first.id });
    let draft = (await page(id)).draft;
    expect(draft).toHaveLength(2);
    expect(draft[1]!.id).not.toBe(first.id);
    expect(draft[1]!.fields).toEqual(first.fields);

    await run({ op: 'addSection', pageId: id, kind: 'hero' });
    const hero = (await page(id)).draft[2]!;
    await run({ op: 'moveSection', pageId: id, sectionId: hero.id, direction: 'up' });
    expect((await page(id)).draft[1]!.id).toBe(hero.id);
    await run({ op: 'toggleSection', pageId: id, sectionId: hero.id });
    expect((await page(id)).draft[1]!.hidden).toBe(true);
    await run({ op: 'removeSection', pageId: id, sectionId: hero.id });
    draft = (await page(id)).draft;
    expect(draft.map((s) => s.kind)).toEqual(['text', 'text']);
  });

  it('validates fields against the spec', async () => {
    const id = await create('About', 'about');
    await run({ op: 'addSection', pageId: id, kind: 'text' });
    const s = (await page(id)).draft[0]!;
    expect(await run({ op: 'updateSection', pageId: id, sectionId: s.id, fields: { body: ' ' }, items: [] })).toEqual({
      ok: false,
      error: 'invalid',
      message: 'Text is required.',
    });
  });

  it('only accepts programs of this space in a curriculum section', async () => {
    const id = await create('About', 'about');
    await run({ op: 'addSection', pageId: id, kind: 'curriculum' });
    const s = (await page(id)).draft[0]!;
    const set = (programSlug: string) =>
      run({ op: 'updateSection', pageId: id, sectionId: s.id, fields: { programSlug }, items: [] });
    expect(await set('nope')).toMatchObject({ error: 'invalid' });
    expect(await set('shibari-101')).toEqual({ ok: true });
  });

  it('only accepts offers of this space in an offer section', async () => {
    await offer('full', 'draft');
    const id = await create('About', 'about');
    await run({ op: 'addSection', pageId: id, kind: 'offer' });
    const s = (await page(id)).draft[0]!;
    const set = (offerSlug: string) => run({ op: 'updateSection', pageId: id, sectionId: s.id, fields: { offerSlug }, items: [] });
    expect(await set('nope')).toEqual({ ok: false, error: 'invalid', message: 'Pick an offer from the list.' });
    expect(await set('full')).toEqual({ ok: true });
  });

  it('reports an unknown section as not found', async () => {
    const id = await create('About', 'about');
    expect(await run({ op: 'removeSection', pageId: id, sectionId: 'x' })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('publish / versions', () => {
  it('needs at least one visible section', async () => {
    const id = await create('About', 'about');
    expect(await run({ op: 'publish', pageId: id })).toMatchObject({ error: 'invalid' });
  });

  it('snapshots the draft, keeps editing private, restores into the draft', async () => {
    const id = await create('About', 'about');
    const s = await withText(id, 'v1');
    expect(await run({ op: 'publish', pageId: id })).toEqual({ ok: true });
    const space = SEED_IDS.alexander;
    expect((await publicPage(repo, space, 'about'))?.sections[0]!.fields.body).toBe('v1');

    await run({ op: 'updateSection', pageId: id, sectionId: s.id, fields: { body: 'v2' }, items: [] });
    expect((await publicPage(repo, space, 'about'))?.sections[0]!.fields.body).toBe('v1');

    const viewer = await owner();
    const { versions } = (await studioPage(repo, viewer, id))!;
    expect(versions).toHaveLength(1);
    expect(await run({ op: 'restoreVersion', pageId: id, versionId: versions[0]!.id })).toEqual({ ok: true });
    expect((await page(id)).draft[0]!.fields.body).toBe('v1');

    await run({ op: 'unpublish', pageId: id });
    expect(await publicPage(repo, space, 'about')).toBeNull();
  });

  it('hides hidden sections from the public', async () => {
    const id = await create('About', 'about');
    await withText(id, 'shown');
    const hidden = await withText(id, 'hidden');
    await run({ op: 'toggleSection', pageId: id, sectionId: hidden.id });
    await run({ op: 'publish', pageId: id });
    expect((await publicPage(repo, SEED_IDS.alexander, 'about'))!.sections.map((x) => x.fields.body)).toEqual(['shown']);
  });

  it('refuses to publish the home page while legal pages are missing (G25)', async () => {
    const id = await create('Home', 'home');
    await settings(id, { isHome: true });
    await withText(id);
    const r = await run({ op: 'publish', pageId: id });
    expect(r).toMatchObject({ error: 'invalid' });
    expect(r.ok ? '' : 'message' in r ? r.message : '').toMatch(/Legal notice/);
    await publishLegal();
    expect(await run({ op: 'publish', pageId: id })).toEqual({ ok: true });
    expect((await homePage(repo, SEED_IDS.alexander))?.page.id).toBe(id);
  });
});

describe('public reads', () => {
  it('lists published posts newest first, never drafts', async () => {
    const a = await create('Old', 'old', 'post');
    await withText(a);
    await editSite(repo, await owner(), { op: 'publish', pageId: a }, new Date('2026-01-01'), newId);
    const b = await create('New', 'new', 'post');
    await withText(b);
    await run({ op: 'publish', pageId: b });
    await create('Draft', 'draft', 'post');
    expect((await blogPosts(repo, SEED_IDS.alexander)).map((p) => p.slug)).toEqual(['new', 'old']);
    expect(await publicPost(repo, SEED_IDS.alexander, 'draft')).toBeNull();
    expect((await publicPost(repo, SEED_IDS.alexander, 'old'))?.page.title).toBe('Old');
    expect(await publicPost(repo, SEED_IDS.natasha, 'old')).toBeNull();
  });

  it('builds chrome from saved nav plus published legal pages', async () => {
    expect(await run({ op: 'saveNav', header: [{ label: 'About', href: '/about' }], footer: [] })).toEqual({ ok: true });
    expect(await run({ op: 'saveNav', header: [{ label: 'X', href: 'javascript:1' }], footer: [] })).toMatchObject({
      error: 'invalid',
    });
    await publishLegal();
    const chrome = await siteChrome(repo, SEED_IDS.alexander);
    expect(chrome.header).toEqual([{ label: 'About', href: '/about' }]);
    expect(chrome.legal.map((l) => l.label)).toEqual(['Legal notice', 'Privacy policy', 'Terms']);
    expect(chrome.legal[0]!.href).toBe('/imprint');
  });

  it('gives studio the legal gaps', async () => {
    const site = (await studioSite(repo, await owner()))!;
    expect(site.legalGaps).toEqual(['imprint', 'privacy', 'terms']);
  });

  it('resolves published curriculum for curriculum sections, published modules + steps only', async () => {
    const sections: SiteSection[] = [
      { id: 's', kind: 'curriculum', hidden: false, fields: { heading: '', programSlug: 'shibari-101' }, items: [] },
    ];
    const refs = await sectionRefs(repo, { id: SEED_IDS.alexander, locale: 'en' }, sections, imageUrl);
    const program = refs.curricula['shibari-101']!;
    expect(program.title).toBeTruthy();
    expect(program.modules.length).toBeGreaterThan(0);
    expect(await sectionRefs(repo, { id: SEED_IDS.natasha, locale: 'en' }, sections, imageUrl)).toEqual({ curricula: {}, offers: {}, images: {} });
  });

  it('resolves published offers of this space for offer sections, price in the space locale', async () => {
    const full = await offer('full', 'published');
    await offer('draft', 'draft');
    await repo.updateOffer(full.id, { description: 'Everything' });
    const sections: SiteSection[] = ['full', 'draft', 'gone'].map((offerSlug, i) => ({
      id: `s${i}`,
      kind: 'offer',
      hidden: false,
      fields: { heading: '', offerSlug },
      items: [],
    }));
    const refs = await sectionRefs(repo, { id: SEED_IDS.alexander, locale: 'en' }, sections, imageUrl);
    expect(refs.offers).toEqual({
      full: { title: 'Full access', description: 'Everything', price: '€49.00', href: '/checkout/full' },
    });
    expect((await sectionRefs(repo, { id: SEED_IDS.natasha, locale: 'en' }, sections, imageUrl)).offers).toEqual({});
  });

  it('lists programs and offers of this space as section choices', async () => {
    await offer('full', 'draft');
    const choices = await sectionChoices(repo, SEED_IDS.alexander);
    expect(choices.program.map((p) => p.slug)).toContain('shibari-101');
    expect(choices.offer).toEqual([{ slug: 'full', title: 'Full access' }]);
    expect((await sectionChoices(repo, SEED_IDS.natasha)).offer).toEqual([]);
  });
});

describe('draftPreview', () => {
  it('renders the draft without hidden sections, for site editors of this space only', async () => {
    const id = await create('About', 'about');
    const shown = await withText(id, 'Shown');
    const gone = await withText(id, 'Gone');
    await run({ op: 'toggleSection', pageId: id, sectionId: gone.id });
    const preview = await draftPreview(repo, await owner(), id);
    expect(preview?.sections.map((s) => s.id)).toEqual([shown.id]);
    expect(preview?.page.publishedAt).toBeNull();
    expect(await draftPreview(repo, await as(SEED_IDS.natashaOwner, 'natasha'), id)).toBeNull();
    expect(await draftPreview(repo, await as(null), id)).toBeNull();
  });
});
