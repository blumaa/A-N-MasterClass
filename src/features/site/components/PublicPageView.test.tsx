import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Page } from '@/lib/data/types';
import type { SiteSection } from '@/lib/site/sections';
import { PublicPageView } from './PublicPageView';

const page: Page = {
  id: 'p', spaceId: 's', kind: 'page', slug: 'about', title: 'About', isHome: false, legalKind: null,
  seoTitle: null, seoDescription: null, draft: [], published: [], publishedAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
};
const hero: SiteSection = { id: 'h', kind: 'hero', hidden: false, fields: { heading: 'Welcome' }, items: [] };
const text: SiteSection = { id: 't', kind: 'text', hidden: false, fields: { heading: 'Story', body: 'Long ago' }, items: [] };

describe('PublicPageView', () => {
  it('lets a leading hero own the h1', () => {
    render(<PublicPageView page={page} sections={[hero, text]} curricula={{}} />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Welcome']);
  });

  it('renders the page title as h1 when no hero leads', () => {
    render(<PublicPageView page={page} sections={[text]} curricula={{}} />);
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Story' })).toBeInTheDocument();
  });

  it('heads a post with its title and date', () => {
    render(<PublicPageView page={{ ...page, kind: 'post' }} sections={[hero]} curricula={{}} />);
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByText('November 1, 2026')).toHaveAttribute('datetime', '2026-11-01T00:00:00.000Z');
  });
});
