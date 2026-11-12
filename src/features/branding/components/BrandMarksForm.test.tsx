import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrandMarksForm } from './BrandMarksForm';

vi.mock('@/components/ImageUpload/actions', () => ({ requestImageUploadAction: vi.fn() }));

const src = (path: string) => `https://files.test/${path}`;
const hidden = (name: string) => document.querySelector<HTMLInputElement>(`input[type=hidden][name="${name}"]`)!.value;
const action = vi.fn(async () => null);

describe('BrandMarksForm', () => {
  it('posts the stored logo and favicon paths and previews them', () => {
    render(<BrandMarksForm action={action} marks={{ logoPath: 's/site/l.png', faviconPath: 's/site/f.png' }} imageSrc={src} />);
    expect(hidden('logoPath')).toBe('s/site/l.png');
    expect(hidden('faviconPath')).toBe('s/site/f.png');
    expect(document.querySelectorAll('img')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Save logo and icon' })).toBeInTheDocument();
  });

  it('posts empty paths when none are set', () => {
    render(<BrandMarksForm action={action} marks={{ logoPath: null, faviconPath: null }} imageSrc={src} />);
    expect(hidden('logoPath')).toBe('');
    expect(hidden('faviconPath')).toBe('');
  });
});
