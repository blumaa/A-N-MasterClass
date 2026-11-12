import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { QuizAttempt, QuizQuestion } from '@/lib/data/types';
import { QuizBlock } from './QuizBlock';

vi.mock('../actions', () => ({ submitQuizAction: vi.fn() }));

const questions: QuizQuestion[] = [
  { id: 'q1', partId: 'p1', prompt: 'Which knot?', position: 0, multiple: false, options: [{ id: 'o1', label: 'Single column' }, { id: 'o2', label: 'Double column' }] },
  { id: 'q2', partId: 'p1', prompt: 'Safety tools?', position: 1, multiple: true, options: [{ id: 'o3', label: 'Shears' }, { id: 'o4', label: 'Lighter' }] },
];
const latest: QuizAttempt = { id: 'a1', partId: 'p1', profileId: 'm', score: 50, passed: false, correctQuestionIds: ['q1'], createdAt: new Date() };
const props = { programSlug: 'shibari-101', stepId: 's1', partId: 'p1', passPercent: 80 };

it('renders radios for one answer, checkboxes for many, named by question', () => {
  render(<QuizBlock {...props} quiz={{ questions, latest: null }} />);
  const single = screen.getByRole('group', { name: 'Which knot?' });
  expect(single.querySelectorAll('input[type=radio][name="answer:q1"]')).toHaveLength(2);
  const many = screen.getByRole('group', { name: 'Safety tools?' });
  expect(many.querySelectorAll('input[type=checkbox][name="answer:q2"]')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Submit answers' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).toBeNull();
});

it('shows the latest score, pass state and right/wrong per question, then offers a retake', () => {
  render(<QuizBlock {...props} quiz={{ questions, latest }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Your score: 50%');
  expect(screen.getByText('Not passed')).toBeInTheDocument();
  expect(screen.getByText('Pass mark: 80%')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Which knot?' })).toHaveTextContent('Correct');
  expect(screen.getByRole('group', { name: 'Safety tools?' })).toHaveTextContent('Incorrect');
  expect(screen.getByRole('button', { name: 'Retake quiz' })).toBeInTheDocument();
});

it('has no pass badge without a pass mark, and a note when there are no questions', () => {
  const { rerender } = render(<QuizBlock {...props} passPercent={null} quiz={{ questions, latest: { ...latest, passed: true } }} />);
  expect(screen.queryByText('Passed')).toBeNull();
  rerender(<QuizBlock {...props} quiz={{ questions: [], latest: null }} />);
  expect(screen.getByText('This quiz has no questions yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
});
