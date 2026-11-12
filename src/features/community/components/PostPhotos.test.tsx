import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PostPhotos } from './PostPhotos';

const photos = [
  { id: 'ph1', href: '/community/c/posts/p/photos/ph1' },
  { id: 'ph2', href: '/community/c/posts/p/photos/ph2' },
];

describe('PostPhotos', () => {
  it('shows each photo through its signed route, opening it full size', () => {
    render(<PostPhotos postId="p" photos={photos} action={vi.fn()} remove={false} />);
    const images = screen.getAllByRole('img');
    expect(images.map((i) => i.getAttribute('src'))).toEqual(photos.map((p) => p.href));
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', photos[0].href);
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  });

  it('offers removal per photo when allowed', () => {
    render(<PostPhotos postId="p" photos={photos} action={vi.fn()} remove />);
    expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(2);
    const ids = [...document.querySelectorAll<HTMLInputElement>('input[name=photoId]')].map((i) => i.value);
    expect(ids).toEqual(['ph1', 'ph2']);
  });

  it('renders nothing without photos', () => {
    const { container } = render(<PostPhotos postId="p" photos={[]} action={vi.fn()} remove />);
    expect(container).toBeEmptyDOMElement();
  });
});
