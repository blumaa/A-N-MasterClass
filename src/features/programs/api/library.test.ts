import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { library } from './library';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

describe('library', () => {
  it('lists published programs of the space with the student’s progress', async () => {
    await repo.setStepComplete(SEED_IDS.student, 'step-intro', true);
    const items = await library(repo, await as(SEED_IDS.student), NOW);
    expect(items.map((i) => [i.program.slug, i.hasAccess, i.completed, i.total])).toEqual([['shibari-101', true, 1, 6]]);
  });

  it('skips drafts for students and marks programs without a grant', async () => {
    await repo.createProduct({ spaceId: SEED_IDS.alexander, kind: 'program', slug: 'draft', title: 'Draft' });
    const items = await library(repo, await as(null), NOW);
    expect(items.map((i) => [i.program.slug, i.hasAccess])).toEqual([['shibari-101', false]]);
  });

  it('stays inside the viewer’s space', async () => {
    const items = await library(repo, await as(SEED_IDS.student, 'natasha'), NOW);
    expect(items.map((i) => i.program.slug)).toEqual(['floor-work']);
  });
});
