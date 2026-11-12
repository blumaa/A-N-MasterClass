import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoverField } from './CoverField';

vi.mock('@/components/ImageUpload/actions', () => ({ requestImageUploadAction: vi.fn() }));

const src = (path: string) => `https://files.test/${path}`;
const hidden = () => document.querySelector<HTMLInputElement>('input[type=hidden][name="coverPath"]')!.value;

describe('CoverField', () => {
  it('posts the stored cover path and previews it', () => {
    render(<form><CoverField path="s/site/c.jpg" imageSrc={src} /></form>);
    expect(hidden()).toBe('s/site/c.jpg');
    expect(screen.getByRole('img', { name: 'Image preview' })).toHaveAttribute('src', 'https://files.test/s/site/c.jpg');
  });

  it('posts blank when the product has no cover', () => {
    render(<form><CoverField path={null} imageSrc={src} /></form>);
    expect(hidden()).toBe('');
    expect(screen.getByText('Cover image')).toBeInTheDocument();
  });
});
