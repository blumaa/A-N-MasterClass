import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { programOutline } from './outline';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
const ALL_STEPS = ['step-intro', 'step-safety', 'step-single-column', 'step-double-column', 'step-week2', 'step-replay'];

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

  it('keeps a quiz-locked module shut until a passing attempt (G26)', async () => {
    const quiz = await repo.createPart({ stepId: 'step-intro', kind: 'quiz' });
    await repo.updatePart(quiz.id, { passPercent: 100 });
    await repo.saveQuizQuestion({ partId: quiz.id, questionId: null, prompt: 'Q', options: [{ label: 'Yes', correct: true }, { label: 'No', correct: false }] });
    await repo.updateModule('mod-basics', { unlockAfterStepId: null, unlockQuizPartId: quiz.id });
    const [q] = await repo.quizQuestions([quiz.id]);
    const outline = async () => (await programOutline(repo, await as(SEED_IDS.student), 'shibari-101', NOW))!;
    expect((await outline()).modules[1]?.access).toEqual({ kind: 'quiz_locked', quizPartId: quiz.id });
    await repo.submitQuiz(quiz.id, SEED_IDS.student, [q!.options[1]!.id]);
    expect((await outline()).modules[1]?.access.kind).toBe('quiz_locked');
    await repo.submitQuiz(quiz.id, SEED_IDS.student, [q!.options[0]!.id]);
    expect((await outline()).modules[1]?.access.kind).toBe('open');
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

  it('offers the certificate only when on, granted and every counted step is done (G26)', async () => {
    const ready = async (who: string) => (await programOutline(repo, await as(who), 'shibari-101', NOW))!.certificateReady;
    for (const s of ALL_STEPS) await repo.setStepComplete(SEED_IDS.student, s, true);
    expect(await ready(SEED_IDS.student)).toBe(false);
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    expect(await ready(SEED_IDS.student)).toBe(true);
    expect(await ready(SEED_IDS.assistant)).toBe(false);
    await repo.setStepComplete(SEED_IDS.student, 'step-replay', false);
    expect(await ready(SEED_IDS.student)).toBe(false);
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
