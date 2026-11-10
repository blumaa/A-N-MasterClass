import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { curriculum, editCurriculum, studioPrograms } from './curriculum';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

describe('studio reads', () => {
  it('lists programs to editors only', async () => {
    expect((await studioPrograms(repo, await as(SEED_IDS.assistant)))?.map((p) => p.slug)).toEqual(['shibari-101']);
    expect(await studioPrograms(repo, await as(SEED_IDS.student))).toBeNull();
  });

  it('returns the full tree with parts for an editor', async () => {
    const tree = (await curriculum(repo, await as(SEED_IDS.alexanderOwner), 'shibari-101'))!;
    expect(tree.modules.map((m) => m.steps.length)).toEqual([2, 2, 1, 1]);
    expect(tree.modules[0]?.steps[0]?.parts.map((p) => p.kind)).toEqual(['video', 'text']);
  });

  it('hides another space’s program', async () => {
    expect(await curriculum(repo, await as(SEED_IDS.natashaOwner, 'natasha'), 'shibari-101')).toBeNull();
  });
});

describe('editCurriculum', () => {
  it('creates a program as draft', async () => {
    const r = await editCurriculum(repo, await as(SEED_IDS.alexanderOwner), {
      op: 'createProgram',
      title: 'Advanced',
      slug: 'advanced',
    });
    expect(r).toMatchObject({ ok: true });
    expect((await repo.productBySlug(SEED_IDS.alexander, 'advanced'))?.status).toBe('draft');
  });

  it('turns repo constraint errors into a result', async () => {
    const r = await editCurriculum(repo, await as(SEED_IDS.alexanderOwner), {
      op: 'createProgram',
      title: 'Dup',
      slug: 'shibari-101',
    });
    expect(r).toEqual({ ok: false, error: 'invalid', message: 'slug taken: shibari-101' });
  });

  it('refuses a student', async () => {
    const r = await editCurriculum(repo, await as(SEED_IDS.student), { op: 'deleteStep', stepId: 'step-intro' });
    expect(r).toEqual({ ok: false, error: 'forbidden' });
    expect(await repo.step('step-intro')).not.toBeNull();
  });

  it('refuses staff of another space (tenant check)', async () => {
    const r = await editCurriculum(repo, await as(SEED_IDS.natashaOwner, 'natasha'), {
      op: 'updatePart',
      partId: 'part-intro-text',
      patch: { text: 'hacked' },
    });
    expect(r).toEqual({ ok: false, error: 'not_found' });
    expect((await repo.part('part-intro-text'))?.text).not.toBe('hacked');
  });

  it('adds a module, step and part', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const m = await editCurriculum(repo, owner, { op: 'createModule', programId: SEED_IDS.program, title: 'Extra' });
    if (!m.ok || !m.id) throw new Error('module');
    const s = await editCurriculum(repo, owner, { op: 'createStep', moduleId: m.id, title: 'Lesson' });
    if (!s.ok || !s.id) throw new Error('step');
    const p = await editCurriculum(repo, owner, { op: 'createPart', stepId: s.id, kind: 'text' });
    expect(p).toMatchObject({ ok: true });
    expect(await repo.parts(s.id)).toHaveLength(1);
  });

  it('refuses a module gate step from another program', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const other = await repo.createProduct({ spaceId: SEED_IDS.alexander, kind: 'program', slug: 'other', title: 'O' });
    const om = await repo.createModule({ programId: other.id, title: 'M' });
    const os = await repo.createStep({ moduleId: om.id, title: 'S' });
    const r = await editCurriculum(repo, owner, {
      op: 'updateModule',
      moduleId: 'mod-basics',
      patch: { unlockAfterStepId: os.id },
    });
    expect(r).toEqual({ ok: false, error: 'invalid', message: 'gate step must belong to this program' });
  });

  it('moves a step', async () => {
    await editCurriculum(repo, await as(SEED_IDS.assistant), { op: 'move', table: 'steps', id: 'step-safety', direction: 'up' });
    expect((await repo.steps(['mod-welcome'])).map((s) => s.id)).toEqual(['step-safety', 'step-intro']);
  });
});
