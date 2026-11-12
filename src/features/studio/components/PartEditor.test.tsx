import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Part } from '@/lib/data/types';
import { PartEditor } from './PartEditor';

vi.mock('../actions', () => ({ editCurriculumAction: vi.fn() }));
vi.mock('@/components/FileUpload/actions', () => ({ requestUploadAction: vi.fn() }));

const part = (over: Partial<Part> = {}): Part => ({
  id: 'p1',
  stepId: 's1',
  kind: 'download',
  position: 0,
  title: 'Checklist',
  text: null,
  vimeoId: null,
  aspect: null,
  filePath: null,
  fileSize: null,
  passPercent: null,
  ...over,
});

const hidden = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);

describe('PartEditor download block', () => {
  it('uploads a file instead of typing a path', () => {
    const { container } = render(<PartEditor programId="prog-1" part={part()} first last />);
    expect(screen.queryByLabelText('File path')).toBeNull();
    expect(hidden(container, 'filePath')?.value).toBe('');
    expect(hidden(container, 'fileSize')?.value).toBe('');
  });

  it('keeps the current file and shows its size', () => {
    const { container } = render(
      <PartEditor programId="prog-1" part={part({ filePath: 'sp/prog-1/x-safety.pdf', fileSize: 2048 })} first last />,
    );
    expect(hidden(container, 'filePath')?.value).toBe('sp/prog-1/x-safety.pdf');
    expect(hidden(container, 'fileSize')?.value).toBe('2048');
    expect(screen.getByText(/Current file: x-safety\.pdf/)).toBeInTheDocument();
  });
});

describe('PartEditor quiz block', () => {
  const question = {
    id: 'q1',
    partId: 'p1',
    prompt: 'Which tool?',
    position: 0,
    multiple: false,
    options: [
      { id: 'o1', label: 'Shears', correct: true },
      { id: 'o2', label: 'Glue', correct: false },
    ],
  };

  it('edits the pass mark and each question with its key', () => {
    const { container } = render(<PartEditor programId="prog-1" part={part({ kind: 'quiz', passPercent: 80 })} first last questions={[question]} />);
    expect(screen.getByLabelText('Pass mark (%)')).toHaveValue(80);
    const prompts = screen.getAllByLabelText('Question') as HTMLInputElement[];
    expect(prompts.map((p) => p.value)).toEqual(['Which tool?', '']);
    const firstForm = prompts[0]!.closest('form')!;
    expect(firstForm.querySelector<HTMLInputElement>('input[name="questionId"]')?.value).toBe('q1');
    const correct = [...firstForm.querySelectorAll<HTMLInputElement>('input[name="correct"]')];
    expect(correct.map((c) => [c.value, c.checked])).toEqual([
      ['0', true],
      ['1', false],
      ['2', false],
      ['3', false],
      ['4', false],
      ['5', false],
    ]);
    expect(firstForm.querySelectorAll('input[name="option"]')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Delete question' })).toBeInTheDocument();
    expect(hidden(container, 'op')).not.toBeNull();
  });

  it('offers an empty add form when the quiz has no questions', () => {
    render(<PartEditor programId="prog-1" part={part({ kind: 'quiz' })} first last />);
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete question' })).toBeNull();
  });
});
