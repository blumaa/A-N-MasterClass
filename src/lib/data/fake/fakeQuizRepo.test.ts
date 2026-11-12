import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError, QUIZ_EMPTY, QUIZ_OPTION_LABEL, QUIZ_PASS_PERCENT, QUIZ_PROMPT, QUIZ_QUESTION_OPTIONS } from '../errors';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

let repo: FakeRepo;
let quiz: string;
beforeEach(async () => {
  repo = createFakeRepo(seedDb(new Date('2026-11-12T12:00:00Z')));
  quiz = (await repo.createPart({ stepId: 'step-safety', kind: 'quiz' })).id;
});

const opts = (...rows: [string, boolean][]) => rows.map(([label, correct]) => ({ label, correct }));

describe('quiz questions', () => {
  it('saves questions in order, derives checkbox questions, hides nothing from the key', async () => {
    const q1 = await repo.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'One?', options: opts(['A', true], ['B', false]) });
    const q2 = await repo.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'Two?', options: opts(['C', true], ['D', true]) });
    const questions = await repo.quizQuestions([quiz]);
    expect(questions.map((q) => [q.id, q.position, q.multiple])).toEqual([
      [q1, 0, false],
      [q2, 1, true],
    ]);
    expect(questions[0]!.options.map((o) => o.label)).toEqual(['A', 'B']);
    const key = await repo.quizKey([quiz]);
    expect(key.size).toBe(3);
    expect(key.has(questions[0]!.options[1]!.id)).toBe(false);
  });

  it('replaces options on edit and deletes a question', async () => {
    const q = await repo.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'One?', options: opts(['A', true], ['B', false]) });
    await repo.saveQuizQuestion({ partId: quiz, questionId: q, prompt: 'Edited', options: opts(['X', false], ['Y', false], ['Z', true]) });
    expect(await repo.quizQuestion(q)).toMatchObject({ prompt: 'Edited', options: [{ label: 'X' }, { label: 'Y' }, { label: 'Z' }] });
    await repo.deleteQuizQuestion(q);
    expect(await repo.quizQuestion(q)).toBeNull();
  });

  it('refuses bad questions with the SQL messages', async () => {
    const save = (prompt: string, options: { label: string; correct: boolean }[]) =>
      repo.saveQuizQuestion({ partId: quiz, questionId: null, prompt, options });
    await expect(save('Q', opts(['A', true]))).rejects.toThrow(new ConstraintError(QUIZ_QUESTION_OPTIONS));
    await expect(save('Q', opts(['A', false], ['B', false]))).rejects.toThrow(QUIZ_QUESTION_OPTIONS);
    await expect(save(' ', opts(['A', true], ['B', false]))).rejects.toThrow(QUIZ_PROMPT);
    await expect(save('Q', opts(['A', true], [' ', false]))).rejects.toThrow(QUIZ_OPTION_LABEL);
    const text = await repo.createPart({ stepId: 'step-safety', kind: 'text' });
    await expect(repo.saveQuizQuestion({ partId: text.id, questionId: null, prompt: 'Q', options: opts(['A', true], ['B', false]) })).rejects.toThrow();
    await expect(repo.updatePart(quiz, { passPercent: 0 })).rejects.toThrow(QUIZ_PASS_PERCENT);
  });
});

describe('quiz attempts', () => {
  it('grades on submit, stores attempts newest first', async () => {
    await repo.updatePart(quiz, { passPercent: 60 });
    await repo.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'One?', options: opts(['A', true], ['B', false]) });
    await repo.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'Two?', options: opts(['C', true], ['D', true]) });
    const [one, two] = await repo.quizQuestions([quiz]);
    const half = await repo.submitQuiz(quiz, SEED_IDS.student, [one!.options[0]!.id, two!.options[0]!.id]);
    expect(half).toMatchObject({ score: 50, passed: false, correctQuestionIds: [one!.id] });
    const all = await repo.submitQuiz(quiz, SEED_IDS.student, [one!.options[0]!.id, ...two!.options.map((o) => o.id)]);
    expect(all).toMatchObject({ score: 100, passed: true });
    expect((await repo.quizAttempts(SEED_IDS.student, [quiz])).length).toBe(2);
    expect(await repo.quizAttempts(SEED_IDS.alexanderOwner, [quiz])).toEqual([]);
  });

  it('refuses an empty quiz', async () => {
    await expect(repo.submitQuiz(quiz, SEED_IDS.student, [])).rejects.toThrow(QUIZ_EMPTY);
  });

  it('deleting the quiz drops its rows and the module lock', async () => {
    await repo.saveQuizQuestion({ partId: quiz, questionId: null, prompt: 'One?', options: opts(['A', true], ['B', false]) });
    const mod = await repo.updateModule('mod-week2', { unlockQuizPartId: quiz });
    expect(mod.unlockQuizPartId).toBe(quiz);
    await repo.deletePart(quiz);
    expect(await repo.quizQuestions([quiz])).toEqual([]);
    expect((await repo.module('mod-week2'))?.unlockQuizPartId).toBeNull();
  });
});
