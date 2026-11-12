import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { completeStep, partDownload, stepOpen, stepView } from './step';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;

describe('stepView', () => {
  it('returns parts, prev and next for an open step', async () => {
    const v = (await stepView(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', NOW))!;
    expect(v.access.kind).toBe('open');
    expect(v.parts.map((p) => p.kind)).toEqual(['video', 'text']);
    expect(v.prevStepId).toBeNull();
    expect(v.nextStepId).toBe('step-safety');
  });

  it('withholds parts of a locked step', async () => {
    const v = (await stepView(repo, await as(SEED_IDS.student), 'shibari-101', 'step-single-column', NOW))!;
    expect(v.access.kind).toBe('locked');
    expect(v.parts).toEqual([]);
  });

  it('withholds parts from a visitor without a grant', async () => {
    const v = (await stepView(repo, await as(null), 'shibari-101', 'step-intro', NOW))!;
    expect(v.access.kind).toBe('no_grant');
    expect(v.parts).toEqual([]);
  });

  it('returns null for a step outside the program', async () => {
    expect(await stepView(repo, await as(SEED_IDS.student), 'shibari-101', 'nope', NOW)).toBeNull();
  });

  it('gives editors every step, open', async () => {
    const v = (await stepView(repo, await as(SEED_IDS.alexanderOwner), 'shibari-101', 'step-replay', NOW))!;
    expect(v.access.kind).toBe('open');
    expect(v.nextStepId).toBeNull();
  });
});

describe('completeStep', () => {
  it('ticks an open step and returns the next one', async () => {
    const r = await completeStep(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', true, NOW);
    expect(r).toEqual({ ok: true, nextStepId: 'step-safety' });
    expect(await repo.completedStepIds(SEED_IDS.student, ['step-intro'])).toEqual(new Set(['step-intro']));
  });

  it('un-ticks', async () => {
    const viewer = await as(SEED_IDS.student);
    await completeStep(repo, viewer, 'shibari-101', 'step-intro', true, NOW);
    await completeStep(repo, viewer, 'shibari-101', 'step-intro', false, NOW);
    expect(await repo.completedStepIds(SEED_IDS.student, ['step-intro'])).toEqual(new Set());
  });

  it('refuses a locked step', async () => {
    const r = await completeStep(repo, await as(SEED_IDS.student), 'shibari-101', 'step-single-column', true, NOW);
    expect(r).toEqual({ ok: false, error: 'not_open' });
  });

  it('refuses an anonymous visitor', async () => {
    const r = await completeStep(repo, await as(null), 'shibari-101', 'step-intro', true, NOW);
    expect(r).toEqual({ ok: false, error: 'signed_out' });
  });
});

describe('stepOpen', () => {
  it('is true only for a step the viewer may open, in their space', async () => {
    expect(await stepOpen(repo, await as(SEED_IDS.student), 'step-intro', NOW)).toBe(true);
    expect(await stepOpen(repo, await as(SEED_IDS.student), 'step-single-column', NOW)).toBe(false);
    expect(await stepOpen(repo, await as(null), 'step-intro', NOW)).toBe(false);
    expect(await stepOpen(repo, await as(SEED_IDS.student), 'nope', NOW)).toBe(false);
    const other = (await resolveViewer(repo, 'natasha', SEED_IDS.natashaOwner))!;
    expect(await stepOpen(repo, other, 'step-intro', NOW)).toBe(false);
  });
});

describe('partDownload', () => {
  const get = async (who: string | null, stepId = 'step-safety', partId = 'part-safety-pdf') =>
    partDownload(repo, await as(who), 'shibari-101', stepId, partId, NOW);

  it('gives the path + save-as name when the viewer can read the step', async () => {
    expect(await get(SEED_IDS.student)).toEqual({ path: 'shibari-101/safety.pdf', name: 'Safety checklist (PDF).pdf' });
    expect(await get(SEED_IDS.assistant)).not.toBeNull();
  });

  it('refuses a visitor without a grant, and a locked step', async () => {
    expect(await get(null)).toBeNull();
    const locked = await repo.createPart({ stepId: 'step-single-column', kind: 'download' });
    await repo.updatePart(locked.id, { filePath: 'a/b/c.pdf' });
    expect(await get(SEED_IDS.student, 'step-single-column', locked.id)).toBeNull();
  });

  it('refuses a part of another step, a non-download part and an empty download part', async () => {
    expect(await get(SEED_IDS.student, 'step-intro', 'part-safety-pdf')).toBeNull();
    expect(await get(SEED_IDS.student, 'step-safety', 'part-safety-text')).toBeNull();
    await repo.updatePart('part-safety-pdf', { filePath: null });
    expect(await get(SEED_IDS.student)).toBeNull();
  });
});
