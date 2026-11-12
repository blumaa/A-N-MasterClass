import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { stepView } from './step';
import { submitQuiz } from './quiz';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let quiz: string;

const as = async (profileId: string | null): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  quiz = (await repo.createPart({ stepId: 'step-intro', kind: 'quiz' })).id;
  await repo.updatePart(quiz, { passPercent: 100 });
  await repo.saveQuizQuestion({
    partId: quiz,
    questionId: null,
    prompt: 'Safe?',
    options: [
      { label: 'Yes', correct: true },
      { label: 'No', correct: false },
    ],
  });
});

const options = async () => (await repo.quizQuestions([quiz]))[0]!.options.map((o) => o.id);

describe('stepView quizzes', () => {
  it('gives questions and the latest attempt, never the key', async () => {
    const before = (await stepView(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', NOW))!;
    expect(before.quizzes[quiz]).toEqual({ questions: await repo.quizQuestions([quiz]), latest: null });
    expect(JSON.stringify(before.quizzes)).not.toMatch(/correct"/);
    const [yes] = await options();
    await submitQuiz(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', quiz, [yes!], NOW);
    const after = (await stepView(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', NOW))!;
    expect(after.quizzes[quiz]?.latest).toMatchObject({ score: 100, passed: true });
  });

  it('withholds quizzes of a closed step', async () => {
    const v = (await stepView(repo, await as(null), 'shibari-101', 'step-intro', NOW))!;
    expect(v.quizzes).toEqual({});
  });
});

describe('submitQuiz', () => {
  it('grades an attempt for a member of an open step', async () => {
    const [, no] = await options();
    const r = await submitQuiz(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', quiz, [no!], NOW);
    expect(r).toMatchObject({ ok: true, attempt: { score: 0, passed: false } });
  });

  it('refuses visitors, closed steps and parts that are not quizzes of the step', async () => {
    expect(await submitQuiz(repo, await as(null), 'shibari-101', 'step-intro', quiz, [], NOW)).toEqual({ ok: false, error: 'signed_out' });
    const locked = await repo.createPart({ stepId: 'step-single-column', kind: 'quiz' });
    expect(await submitQuiz(repo, await as(SEED_IDS.student), 'shibari-101', 'step-single-column', locked.id, [], NOW)).toEqual({
      ok: false,
      error: 'not_open',
    });
    expect(await submitQuiz(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', 'part-intro-text', [], NOW)).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await submitQuiz(repo, await as(SEED_IDS.student), 'shibari-101', 'step-safety', quiz, [], NOW)).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('refuses an empty quiz with the data message', async () => {
    const empty = await repo.createPart({ stepId: 'step-intro', kind: 'quiz' });
    expect(await submitQuiz(repo, await as(SEED_IDS.student), 'shibari-101', 'step-intro', empty.id, [], NOW)).toEqual({
      ok: false,
      error: 'invalid',
      message: 'quiz has no questions',
    });
  });
});
