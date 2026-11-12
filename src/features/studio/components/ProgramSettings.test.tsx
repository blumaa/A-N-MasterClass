import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Product } from '@/lib/data/types';
import { ProgramSettings } from './ProgramSettings';

vi.mock('../actions', () => ({ editCurriculumAction: vi.fn() }));
vi.mock('@/components/ImageUpload/actions', () => ({ requestImageUploadAction: vi.fn() }));

const program: Product = {
  id: 'p', spaceId: 's', kind: 'program', slug: 'shibari-101', title: 'Shibari 101', subtitle: null,
  status: 'published', position: 0, themeOverride: null, certificates: true, coverPath: null,
};

it('shows the certificate toggle with the saved value (G26)', () => {
  render(<ProgramSettings imageSrc={String} program={program} />);
  const select = screen.getByLabelText('Certificate');
  expect(select).toHaveAttribute('name', 'certificates');
  expect(select).toHaveValue('true');
  expect(screen.getByRole('option', { name: 'Give a certificate at 100% completion' })).toBeInTheDocument();
});
