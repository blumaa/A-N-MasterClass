import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Page } from '@/lib/data/types';
import { PageEditor } from './PageEditor';

vi.mock('../actions', () => ({ editSiteAction: vi.fn() }));

const draftOnly: Page = {
  id: 'p1',
  spaceId: 's',
  kind: 'page',
  slug: 'about',
  title: 'About',
  isHome: false,
  legalKind: null,
  seoTitle: null,
  seoDescription: null,
  draft: [{ id: 's1', kind: 'text', hidden: false, fields: { heading: 'Hi', body: 'x' }, items: [] }],
  published: null,
  publishedAt: null,
  updatedAt: new Date(),
};

describe('PageEditor', () => {
  it('offers publish for a draft page and links the preview', () => {
    render(<PageEditor page={draftOnly} versions={[]} programs={[]} />);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview draft' })).toHaveAttribute('href', '/studio/site/pages/p1/preview');
    expect(screen.getByRole('option', { name: 'Hero' })).toBeInTheDocument();
  });

  it('offers unpublish and version restore once published', () => {
    const at = new Date('2026-11-01T10:00:00Z');
    render(
      <PageEditor
        page={{ ...draftOnly, published: draftOnly.draft, publishedAt: at }}
        versions={[{ id: 'v1', pageId: 'p1', sections: [], publishedAt: at }]}
        programs={[]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View live' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('hides home and legal settings for a blog post', () => {
    render(<PageEditor page={{ ...draftOnly, kind: 'post' }} versions={[]} programs={[]} />);
    expect(screen.queryByLabelText('Legal page')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/home page/i)).not.toBeInTheDocument();
  });
});
