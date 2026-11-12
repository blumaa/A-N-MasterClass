import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/data/types';
import { ProductTiles } from './ProductTiles';

const circle: Product = {
  id: 'c', spaceId: 's', kind: 'community', slug: 'circle', title: 'Circle', subtitle: null,
  status: 'published', position: 0, themeOverride: null, certificates: false, coverPath: null,
};

describe('ProductTiles', () => {
  it('lists the products as linked cards under a heading', () => {
    render(<ProductTiles heading="Communities" products={[circle]} href={(s) => `/community/${s}`} imageSrc={String} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Communities' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Communities' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Circle' })).toHaveAttribute('href', '/community/circle');
  });

  it('renders nothing without products', () => {
    render(<ProductTiles heading="Communities" products={[]} href={String} imageSrc={String} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
