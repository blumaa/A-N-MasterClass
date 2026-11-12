// Quiz Supabase repo against the linked project. The editor writes through the service client;
// submit_quiz reads auth.uid(), so the member runs signed in (RLS: 190-quizzes.test.sql).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QUIZ_EMPTY, QUIZ_PASS_PERCENT, QUIZ_QUESTION_OPTIONS } from '@/lib/data/errors';
import { createCoreRepo, type CoreRepo } from './core';
import { createQuizRepo, type QuizRepo } from './quiz';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

describe.skipIf(!contractEnabled)('quiz repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let core: CoreRepo;
  let service: QuizRepo;
  let member: QuizRepo;
  let student: string;
  let quiz: string;
  let empty: string;

  const opts = (...rows: [string, boolean][]) => rows.map(([label, correct]) => ({ label, correct }));

  beforeAll(async () => {
    fx = await createContractSpace('quiz');
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    core = createCoreRepo(ctx);
    service = createQuizRepo(ctx);
    const prog = await core.createProduct({ spaceId: fx.spaceId, kind: 'program', slug: 'quiz', title: 'Q' });
    await core.updateProduct(prog.id, { status: 'published' });
    const mod = await core.createModule({ programId: prog.id, title: 'M' });
    await core.updateModule(mod.id, { status: 'published' });
    const step = await core.createStep({ moduleId: mod.id, title: 'S' });
    await core.updateStep(step.id, { status: 'published' });
    quiz = (await core.createPart({ stepId: step.id, kind: 'quiz' })).id;
    empty = (await core.createPart({ stepId: step.id, kind: 'quiz' })).id;
    student = await fx.newUser('student');
    await core.createGrant({ productId: prog.id, profileId: student, source: 'manual' });
    const client = await fx.signIn('student', student);
    member = createQuizRepo({ db: async () => client, admin: () => fx.admin });
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  it('saves, edits and lists questions; the key stays with editors', async () => {
    expect((await core.updatePart(quiz, { passPercent: 60 })).passPercent).toBe(60);
    await expect(core.updatePart(quiz, { passPercent: 101 })).rejects.toThrow(QUIZ_PASS_PERCENT);
    const q1 = await service.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'One?', options: opts(['A', false], ['B', true]) });
    await service.saveQuizQuestion({ partId: quiz, questionId: q1, prompt: 'One', options: opts(['A', true], ['B', false]) });
    await service.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'Two', options: opts(['C', true], ['D', true], ['E', false]) });
    await expect(
      service.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'Bad', options: opts(['A', true]) }),
    ).rejects.toThrow(QUIZ_QUESTION_OPTIONS);

    const questions = await member.quizQuestions([quiz]);
    expect(questions.map((q) => [q.prompt, q.position, q.multiple, q.options.map((o) => o.label)])).toEqual([
      ['One', 0, false, ['A', 'B']],
      ['Two', 1, true, ['C', 'D', 'E']],
    ]);
    expect(await member.quizQuestion(q1)).toMatchObject({ prompt: 'One' });
    expect((await service.quizKey([quiz])).size).toBe(3);
    expect((await member.quizKey([quiz])).size).toBe(0);
  });

  it('grades a member attempt on the server', async () => {
    const [one, two] = await member.quizQuestions([quiz]);
    const half = await member.submitQuiz(quiz, student, [one!.options[0]!.id, two!.options[0]!.id]);
    expect(half).toMatchObject({ partId: quiz, profileId: student, score: 50, passed: false, correctQuestionIds: [one!.id] });
    const full = await member.submitQuiz(quiz, student, [one!.options[0]!.id, two!.options[0]!.id, two!.options[1]!.id]);
    expect(full).toMatchObject({ score: 100, passed: true });
    expect((await member.quizAttempts(student, [quiz])).map((a) => a.id)).toEqual([full.id, half.id]);
    await expect(member.submitQuiz(empty, student, [])).rejects.toThrow(QUIZ_EMPTY);
  });

  it('deletes a question', async () => {
    const [one] = await service.quizQuestions([quiz]);
    await service.deleteQuizQuestion(one!.id);
    expect(await service.quizQuestion(one!.id)).toBeNull();
  });
});
