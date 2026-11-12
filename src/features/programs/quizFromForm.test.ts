import { expect, it } from 'vitest';
import { answerField, quizAnswersFromForm } from './quizFromForm';

it('collects picked options from every question group and nothing else', () => {
  const form = new FormData();
  form.set('program', 'p');
  form.append(answerField('q1'), 'o1');
  form.append(answerField('q2'), 'o3');
  form.append(answerField('q2'), 'o4');
  expect(quizAnswersFromForm(form)).toEqual(['o1', 'o3', 'o4']);
});
