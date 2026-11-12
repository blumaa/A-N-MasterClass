import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Page } from '@/lib/data/types';
import { BlogList } from './BlogList';

const post: Page = {
  id: 'p', spaceId: 's', kind: 'post', slug: 'first-tie', title: 'First tie', isHome: false, legalKind: null,
  seoTitle: null, seoDescription: null, draft: [], published: [], publishedAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
};

it('links each post under /blog', () => {
  render(<BlogList posts={[post]} />);
  expect(screen.getByRole('link', { name: /First tie/ })).toHaveAttribute('href', '/blog/first-tie');
});

it('says so when there are no posts', () => {
  render(<BlogList posts={[]} />);
  expect(screen.getByText('No posts yet')).toBeInTheDocument();
});

it('shows the date and the summary of each post', () => {
  render(<BlogList posts={[{ ...post, seoDescription: 'How to tie it.' }]} />);
  const link = screen.getByRole('link', { name: /First tie/ });
  expect(link).toHaveTextContent('How to tie it.');
  expect(link).toHaveTextContent('November 1, 2026');
});
