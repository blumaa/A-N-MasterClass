import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SiteSection } from '@/lib/site/sections';
import { Sections } from './Sections';

const section = (kind: SiteSection['kind'], fields: Record<string, string>, items: Record<string, string>[] = []): SiteSection => ({
  id: `${kind}-1`,
  kind,
  hidden: false,
  fields,
  items,
});

describe('Sections', () => {
  it('renders the hero heading as the page h1 with its button', () => {
    render(<Sections sections={[section('hero', { heading: 'Learn rope', subheading: 'Slowly', ctaLabel: 'Join', ctaHref: '/programs' })]} refs={{ curricula: {}, offers: {} }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Learn rope' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/programs');
  });

  it('skips a button without both label and link', () => {
    render(<Sections sections={[section('cta', { heading: 'Ready?', body: '', ctaLabel: 'Go', ctaHref: '' })]} refs={{ curricula: {}, offers: {} }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a Vimeo player for a video section', () => {
    render(<Sections sections={[section('video', { heading: 'Trailer', vimeoId: '123' })]} refs={{ curricula: {}, offers: {} }} />);
    expect(screen.getByTitle('Trailer')).toHaveAttribute('src', expect.stringContaining('player.vimeo.com/video/123'));
  });

  it('renders the curriculum outline of the named program', () => {
    render(
      <Sections
        sections={[section('curriculum', { heading: '', programSlug: 'shibari-101' })]}
        refs={{ offers: {}, curricula: { 'shibari-101': { title: 'Shibari 101', modules: [{ title: 'Welcome', steps: ['Intro', 'Safety'] }] } } }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Shibari 101' })).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Safety')).toBeInTheDocument();
  });

  it('drops a curriculum section whose program is not published', () => {
    const { container } = render(<Sections sections={[section('curriculum', { heading: 'X', programSlug: 'gone' })]} refs={{ curricula: {}, offers: {} }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an offer card with price and a checkout button', () => {
    const offers = { full: { title: 'Full access', description: 'Everything', price: '€49.00', href: '/checkout/full' } };
    render(<Sections sections={[section('offer', { heading: 'Join now', offerSlug: 'full' })]} refs={{ curricula: {}, offers }} />);
    expect(screen.getByRole('heading', { name: 'Join now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Full access' })).toBeInTheDocument();
    expect(screen.getByText('Everything')).toBeInTheDocument();
    expect(screen.getByText('€49.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buy now' })).toHaveAttribute('href', '/checkout/full');
  });

  it('drops an offer section whose offer is not published', () => {
    const { container } = render(<Sections sections={[section('offer', { heading: 'X', offerSlug: 'gone' })]} refs={{ curricula: {}, offers: {} }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders testimonials and FAQ items', () => {
    render(
      <Sections
        sections={[
          section('testimonials', { heading: 'Students say' }, [{ quote: 'Life changing', name: 'Ana' }]),
          section('faq', { heading: 'FAQ' }, [{ question: 'Beginners?', answer: 'Yes.' }]),
        ]}
        refs={{ curricula: {}, offers: {} }}
      />,
    );
    expect(screen.getByText('Life changing')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beginners?')).toBeInTheDocument();
    expect(screen.getByText('Yes.')).toBeInTheDocument();
  });

  it('uses h2 for a hero when the page already has a title heading', () => {
    render(<Sections sections={[section('hero', { heading: 'Hi' })]} refs={{ curricula: {}, offers: {} }} headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Hi' })).toBeInTheDocument();
  });

  it('gives only a leading hero the h1', () => {
    render(<Sections sections={[section('hero', { heading: 'One' }), { ...section('hero', { heading: 'Two' }), id: 'h2' }]} refs={{ curricula: {}, offers: {} }} />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['One']);
  });
});
