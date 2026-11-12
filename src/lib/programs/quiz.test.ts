import { describe, expect, it } from 'vitest';
import { gradeQuiz, quizOptionsOf } from './quiz';

const questions = [
  { id: 'q1', optionIds: ['a', 'b'], correctIds: ['a'] },
  { id: 'q2', optionIds: ['c', 'd', 'e'], correctIds: ['c', 'd'] },
];

describe('gradeQuiz', () => {
  it('scores the percent of questions right', () => {
    expect(gradeQuiz(questions, ['a', 'c', 'd'], 60)).toEqual({ score: 100, passed: true, correctQuestionIds: ['q1', 'q2'] });
    expect(gradeQuiz(questions, ['b', 'c'], 60)).toEqual({ score: 0, passed: false, correctQuestionIds: [] });
  });

  it('needs exactly the correct options on a checkbox question', () => {
    expect(gradeQuiz(questions, ['a', 'c'], 60).correctQuestionIds).toEqual(['q1']);
    expect(gradeQuiz(questions, ['a', 'c', 'd', 'e'], 60).score).toBe(50);
  });

  it('passes at the mark, or always without one', () => {
    expect(gradeQuiz(questions, ['a'], 50).passed).toBe(true);
    expect(gradeQuiz(questions, ['a'], 51).passed).toBe(false);
    expect(gradeQuiz(questions, [], null).passed).toBe(true);
  });

  it('rounds the score', () => {
    const three = [...questions, { id: 'q3', optionIds: ['f', 'g'], correctIds: ['g'] }];
    expect(gradeQuiz(three, ['a'], null).score).toBe(33);
    expect(gradeQuiz(three, ['a', 'c', 'd'], null).score).toBe(67);
  });
});

describe('quizOptionsOf', () => {
  it('pairs labels with correct flags and drops blank rows', () => {
    expect(quizOptionsOf(['Yes', ' ', 'No', ''], ['0', '3'])).toEqual([
      { label: 'Yes', correct: true },
      { label: 'No', correct: false },
    ]);
  });
});
