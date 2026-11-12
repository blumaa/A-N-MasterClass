import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SiteSection } from '@/lib/site/sections';
import { SectionEditor } from './SectionEditor';

vi.mock('../actions', () => ({ editSiteAction: vi.fn() }));
vi.mock('@/components/ImageUpload/actions', () => ({ requestImageUploadAction: vi.fn() }));

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
    render(<SectionEditor pageId="p1" section={faq} choices={{ program: [], offer: [] }} first last />);
    expect(screen.getByLabelText('Heading')).toHaveAttribute('name', 'f.heading');
    expect(screen.getByDisplayValue('Beginners?')).toHaveAttribute('name', 'i.0.question');
    expect(document.querySelector('[name="i.1.question"]')).toHaveValue('');
    expect(hidden('op')).toHaveValue('updateSection');
    expect(hidden('sectionId')).toHaveValue('s1');
  });

  it('offers programs for a curriculum section', () => {
    const section: SiteSection = { id: 's2', kind: 'curriculum', hidden: false, fields: { heading: '', programSlug: 'b' }, items: [] };
    render(<SectionEditor pageId="p1" section={section} choices={{ program: [{ slug: "a", title: "A" }, { slug: "b", title: "B" }], offer: [] }} first last />);
    expect(screen.getByLabelText(/^Program/)).toHaveValue('b');
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });

  it('offers offers for an offer section', () => {
    const section: SiteSection = { id: 's3', kind: 'offer', hidden: false, fields: { heading: '', offerSlug: '' }, items: [] };
    render(<SectionEditor pageId="p1" section={section} choices={{ program: [], offer: [{ slug: 'full', title: 'Full access' }] }} first last />);
    expect(screen.getByLabelText(/^Offer/)).toHaveAttribute('name', 'f.offerSlug');
    expect(screen.getByRole('option', { name: 'Full access' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Choose an offer' })).toBeInTheDocument();
  });

  it('shows only the moves that make sense and labels hidden sections', () => {
    render(<SectionEditor pageId="p1" section={{ ...faq, hidden: true }} choices={{ program: [], offer: [] }} first last={false} />);
    expect(screen.queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('uses an image upload and a background choice for a hero', () => {
    const hero: SiteSection = { id: 'h', kind: 'hero', hidden: false, fields: { heading: 'Hi', image: 'sp/site/a.jpg', layout: 'split' }, items: [] };
    render(<SectionEditor pageId="p1" section={hero} choices={{ program: [], offer: [] }} images={{ 'sp/site/a.jpg': 'https://cdn.test/a.jpg' }} first last />);
    expect(hidden('f.image')).toHaveValue('sp/site/a.jpg');
    expect(screen.getByRole('img', { name: 'Image preview' })).toHaveAttribute('src', 'https://cdn.test/a.jpg');
    expect(screen.getByLabelText('Layout')).toHaveValue('split');
    expect(screen.getByLabelText('Background')).toHaveValue('plain');
    expect(screen.getByRole('option', { name: 'Photo beside text' })).toBeInTheDocument();
  });
});
