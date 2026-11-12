import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioNav } from './StudioNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/studio/offers/o1' }));

describe('StudioNav', () => {
  it('marks the current section', () => {
    render(
      <StudioNav
        items={[
          { href: '/studio', label: 'Programs' },
          { href: '/studio/offers', label: 'Offers' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Offers' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Programs' })).not.toHaveAttribute('aria-current');
  });
});
