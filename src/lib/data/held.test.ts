import { describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo } from './fake/fakeRepo';
import { SEED_IDS, seedDb } from './fake/seed';
import { heldProducts, productPage } from './held';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('heldProducts', () => {
  it('lists published products of a kind the viewer holds', async () => {
    const repo = createFakeRepo(seedDb(NOW));
    const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;
    expect((await heldProducts(repo, await as(SEED_IDS.student), 'podcast', NOW)).map((p) => p.slug)).toEqual(['rope-talk']);
    expect(await heldProducts(repo, await as(SEED_IDS.assistant), 'podcast', NOW)).toEqual([]);
    expect(await heldProducts(repo, await as(null), 'download', NOW)).toEqual([]);
    repo.db.products.find((p) => p.id === SEED_IDS.downloads)!.status = 'draft';
    expect(await heldProducts(repo, await as(SEED_IDS.student), 'download', NOW)).toEqual([]);
  });
});

describe('productPage', () => {
  it('finds a product of the kind by slug, with access and editor flags', async () => {
    const repo = createFakeRepo(seedDb(NOW));
    const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;
    expect(await productPage(repo, await as(SEED_IDS.student), 'podcast', 'rope-talk', NOW)).toMatchObject({
      product: { id: SEED_IDS.podcast },
      hasAccess: true,
      isEditor: false,
    });
    expect(await productPage(repo, await as(SEED_IDS.assistant), 'podcast', 'rope-talk', NOW)).toMatchObject({ hasAccess: false, isEditor: true });
    expect(await productPage(repo, await as(null), 'podcast', 'pattern-pack', NOW)).toBeNull();
    expect(await productPage(repo, await as(null), 'podcast', 'nope', NOW)).toBeNull();
    repo.db.products.find((p) => p.id === SEED_IDS.podcast)!.status = 'draft';
    expect(await productPage(repo, await as(SEED_IDS.student), 'podcast', 'rope-talk', NOW)).toBeNull();
    expect(await productPage(repo, await as(SEED_IDS.assistant), 'podcast', 'rope-talk', NOW)).not.toBeNull();
  });
});
