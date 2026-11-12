import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ProductCard, ProductCardGrid } from './ProductCard';

const inGrid = (card: ReactNode) => render(<ProductCardGrid label="Programs">{card}</ProductCardGrid>);

describe('ProductCard', () => {
  it('shows the cover as decoration next to the title', () => {
    const { container } = inGrid(<ProductCard title="Floorwork" subtitle="Ten weeks" coverSrc="https://files.test/s/site/c.jpg" headingLevel={2} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('files.test');
    expect(img).toHaveAttribute('alt', '');
    expect(screen.getByRole('heading', { level: 2, name: 'Floorwork' })).toBeInTheDocument();
    expect(screen.getByText('Ten weeks')).toBeInTheDocument();
  });

  it('draws a placeholder with the first letter when there is no cover', () => {
    const { container } = inGrid(<ProductCard title="floorwork" headingLevel={3} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('F');
  });

  it('links the title when given an href, so the whole card is one target', () => {
    inGrid(<ProductCard title="Circle" href="/community/circle" headingLevel={3} />);
    expect(screen.getByRole('link', { name: 'Circle' })).toHaveAttribute('href', '/community/circle');
  });

  it('renders extra content under the text', () => {
    inGrid(
      <ProductCard title="X" headingLevel={3}>
        <p>3 of 10 lessons</p>
      </ProductCard>,
    );
    expect(screen.getByText('3 of 10 lessons')).toBeInTheDocument();
  });

  it('lays cards out as a labelled list', () => {
    inGrid(<ProductCard title="X" headingLevel={3} />);
    expect(screen.getByRole('list', { name: 'Programs' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
