import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SiteSection } from '@/lib/site/sections';
import { SectionEditor } from './SectionEditor';

vi.mock('../actions', () => ({ editSiteAction: vi.fn() }));

const faq: SiteSection = {
  id: 's1',
  kind: 'faq',
  hidden: false,
  fields: { heading: 'FAQ' },
  items: [{ question: 'Beginners?', answer: 'Yes.' }],
};

const hidden = (name: string) => document.querySelector(`input[type="hidden"][name="${name}"]`);

describe('SectionEditor', () => {
  it('posts fields as f.<name> and item rows as i.<row>.<name>, plus one blank row', () => {
    render(<SectionEditor pageId="p1" section={faq} programs={[]} first last />);
    expect(screen.getByLabelText('Heading')).toHaveAttribute('name', 'f.heading');
    expect(screen.getByDisplayValue('Beginners?')).toHaveAttribute('name', 'i.0.question');
    expect(document.querySelector('[name="i.1.question"]')).toHaveValue('');
    expect(hidden('op')).toHaveValue('updateSection');
    expect(hidden('sectionId')).toHaveValue('s1');
  });

  it('offers programs for a curriculum section', () => {
    const section: SiteSection = { id: 's2', kind: 'curriculum', hidden: false, fields: { heading: '', programSlug: 'b' }, items: [] };
    render(<SectionEditor pageId="p1" section={section} programs={[{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }]} first last />);
    expect(screen.getByLabelText(/^Program/)).toHaveValue('b');
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });

  it('shows only the moves that make sense and labels hidden sections', () => {
    render(<SectionEditor pageId="p1" section={{ ...faq, hidden: true }} programs={[]} first last={false} />);
    expect(screen.queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });
});
