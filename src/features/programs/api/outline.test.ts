import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { programOutline } from './outline';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

describe('programOutline (student)', () => {
  it('shows every access state of the seed tree', async () => {
    const o = (await programOutline(repo, await as(SEED_IDS.student), 'shibari-101', NOW))!;
    expect(o.modules.map((m) => [m.title, m.access.kind])).toEqual([
      ['Welcome', 'open'],
      ['Basics', 'locked'],
      ['Week two', 'drip'],
      ['Live session replay', 'drip'],
    ]);
  });

  it('opens a locked module once its gate step is ticked', async () => {
    await repo.setStepComplete(SEED_IDS.student, 'step-safety', true);
    const o = (await programOutline(repo, await as(SEED_IDS.student), 'shibari-101', NOW))!;
    expect(o.modules[1]?.access.kind).toBe('open');
  });

  it('counts published steps and points Continue at the first open unticked step', async () => {
    await repo.setStepComplete(SEED_IDS.student, 'step-intro', true);
    const o = (await programOutline(repo, await as(SEED_IDS.student), 'shibari-101', NOW))!;
    expect(o.completed).toBe(1);
    expect(o.total).toBe(6);
    expect(o.continueStepId).toBe('step-safety');
  });

  it('hides draft steps and modules from students and from the count', async () => {
    await repo.updateStep('step-replay', { status: 'draft' });
    const o = (await programOutline(repo, await as(SEED_IDS.student), 'shibari-101', NOW))!;
    expect(o.total).toBe(5);
    expect(o.modules.find((m) => m.id === 'mod-live')?.steps).toEqual([]);
  });

  it('visitor without grant sees outline marked no_grant', async () => {
    const o = (await programOutline(repo, await as(null), 'shibari-101', NOW))!;
    expect(o.hasAccess).toBe(false);
    expect(o.modules[0]?.access.kind).toBe('no_grant');
  });

  it('draft program = null for students, visible for editors', async () => {
    await repo.updateProduct(SEED_IDS.program, { status: 'draft' });
    expect(await programOutline(repo, await as(SEED_IDS.student), 'shibari-101', NOW)).toBeNull();
    const o = await programOutline(repo, await as(SEED_IDS.assistant), 'shibari-101', NOW);
    expect(o?.isEditor).toBe(true);
    expect(o?.modules.every((m) => m.access.kind === 'open')).toBe(true);
  });

  it('never leaks a program of another space', async () => {
    expect(await programOutline(repo, await as(SEED_IDS.student, 'natasha'), 'shibari-101', NOW)).toBeNull();
  });
});
