import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Page } from '@/lib/data/types';
import { SiteOverview } from './SiteOverview';

vi.mock('../actions', () => ({ editSiteAction: vi.fn() }));

const page = (over: Partial<Page>): Page => ({
  id: 'p1',
  spaceId: 's',
  kind: 'page',
  slug: 'home',
  title: 'Home',
  isHome: true,
  legalKind: null,
  seoTitle: null,
  seoDescription: null,
  draft: [],
  published: [],
  publishedAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe('SiteOverview', () => {
  it('lists pages and posts linking to their editors with status', () => {
    render(
      <SiteOverview
        site={{
          pages: [page({})],
          posts: [page({ id: 'b1', kind: 'post', slug: 'hello', title: 'Hello', isHome: false, published: null })],
          legalGaps: [],
          header: [],
          footer: [],
        }}
      />,
    );
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/studio/site/pages/p1');
    expect(screen.getByRole('link', { name: /Hello/ })).toHaveAttribute('href', '/studio/site/pages/b1');
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('warns about missing legal pages', () => {
    render(<SiteOverview site={{ pages: [], posts: [], legalGaps: ['imprint', 'terms'], header: [], footer: [] }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Legal notice.*Terms/);
  });
});
