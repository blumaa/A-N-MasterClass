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
