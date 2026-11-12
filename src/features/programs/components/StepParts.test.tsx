import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Part } from '@/lib/data/types';
import { StepParts } from './StepParts';

vi.mock('../actions', () => ({ submitQuizAction: vi.fn() }));

const base: Part = { id: 'p1', stepId: 's1', kind: 'download', title: 'Checklist', position: 0, text: null, vimeoId: null, aspect: null, filePath: 'sp/pr/u-checklist.pdf', fileSize: 1_200_000, passPercent: null };

it('links a download part to the signed route with its title and size', () => {
  render(<StepParts programSlug="shibari-101" parts={[base]} />);
  expect(screen.getByRole('link', { name: 'Checklist' })).toHaveAttribute('href', '/programs/shibari-101/s1/files/p1');
  expect(screen.getByText('PDF · 1.2 MB')).toBeInTheDocument();
  expect(screen.queryByText(/sp\/pr/)).toBeNull();
});

it('skips a download part without a file; untitled falls back to "Download"', () => {
  render(<StepParts programSlug="x" parts={[{ ...base, filePath: null }, { ...base, id: 'p2', title: null, fileSize: null }]} />);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', '/programs/x/s1/files/p2');
  expect(screen.getByText('PDF')).toBeInTheDocument();
});

it('renders a quiz part from its quiz view', () => {
  const quiz: Part = { ...base, id: 'qz', kind: 'quiz', title: 'Check', filePath: null, passPercent: 60 };
  const question = { id: 'q1', partId: 'qz', prompt: 'Pick one', position: 0, multiple: false, options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }] };
  render(<StepParts programSlug="x" parts={[quiz]} quizzes={{ qz: { questions: [question], latest: null } }} />);
  expect(screen.getByRole('group', { name: 'Pick one' })).toBeInTheDocument();
});
