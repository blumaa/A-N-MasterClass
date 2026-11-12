import { Fragment } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SiteSection } from '@/lib/site/sections';
import { Sections } from './Sections';
import type { SectionRefs } from '../api/site';

const NO_REFS: SectionRefs = { curricula: {}, offers: {}, images: {} };

const section = (kind: SiteSection['kind'], fields: Record<string, string>, items: Record<string, string>[] = []): SiteSection => ({
  id: `${kind}-1`,
  kind,
  hidden: false,
  fields,
  items,
});

describe('Sections', () => {
  it('renders the hero heading as the page h1 with its button', () => {
    render(<Sections sections={[section('hero', { heading: 'Learn rope', subheading: 'Slowly', ctaLabel: 'Join', ctaHref: '/programs' })]} refs={NO_REFS} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Learn rope' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/programs');
  });

  it('gives the button light ink on a dark band', () => {
    render(<Sections sections={[section('cta', { heading: 'Ready?', ctaLabel: 'Go', ctaHref: '/go', tone: 'dark' })]} refs={NO_REFS} />);
    expect(screen.getByRole('link', { name: 'Go' }).className).toContain('mds-Button__on-media');
  });

  it('keeps the plain button on a light band', () => {
    render(<Sections sections={[section('cta', { heading: 'Ready?', ctaLabel: 'Go', ctaHref: '/go', tone: 'plain' })]} refs={NO_REFS} />);
    expect(screen.getByRole('link', { name: 'Go' }).className).not.toContain('mds-Button__on-media');
  });

  it('skips a button without both label and link', () => {
    render(<Sections sections={[section('cta', { heading: 'Ready?', body: '', ctaLabel: 'Go', ctaHref: '' })]} refs={NO_REFS} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a Vimeo player for a video section', () => {
    render(<Sections sections={[section('video', { heading: 'Trailer', vimeoId: '123' })]} refs={NO_REFS} />);
    expect(screen.getByTitle('Trailer')).toHaveAttribute('src', expect.stringContaining('player.vimeo.com/video/123'));
  });

  it('renders the curriculum outline of the named program', () => {
    render(
      <Sections
        sections={[section('curriculum', { heading: '', programSlug: 'shibari-101' })]}
        refs={{ ...NO_REFS, curricula: { 'shibari-101': { title: 'Shibari 101', modules: [{ title: 'Welcome', steps: ['Intro', 'Safety'] }] } } }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Shibari 101' })).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Safety')).toBeInTheDocument();
  });

  it('drops a curriculum section whose program is not published', () => {
    const { container } = render(<Sections sections={[section('curriculum', { heading: 'X', programSlug: 'gone' })]} refs={NO_REFS} />, { wrapper: Fragment });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an offer card with price and a checkout button', () => {
    const offers = { full: { title: 'Full access', description: 'Everything', price: '€49.00', href: '/checkout/full' } };
    render(<Sections sections={[section('offer', { heading: 'Join now', offerSlug: 'full' })]} refs={{ ...NO_REFS, offers }} />);
    expect(screen.getByRole('heading', { name: 'Join now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Full access' })).toBeInTheDocument();
    expect(screen.getByText('Everything')).toBeInTheDocument();
    expect(screen.getByText('€49.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buy now' })).toHaveAttribute('href', '/checkout/full');
  });

  it('drops an offer section whose offer is not published', () => {
    const { container } = render(<Sections sections={[section('offer', { heading: 'X', offerSlug: 'gone' })]} refs={NO_REFS} />, { wrapper: Fragment });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders testimonials and FAQ items', () => {
    render(
      <Sections
        sections={[
          section('testimonials', { heading: 'Students say' }, [{ quote: 'Life changing', name: 'Ana' }]),
          section('faq', { heading: 'FAQ' }, [{ question: 'Beginners?', answer: 'Yes.' }]),
        ]}
        refs={NO_REFS}
      />,
    );
    expect(screen.getByText('Life changing')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beginners?')).toBeInTheDocument();
    expect(screen.getByText('Yes.')).toBeInTheDocument();
  });

  it('uses h2 for a hero when the page already has a title heading', () => {
    render(<Sections sections={[section('hero', { heading: 'Hi' })]} refs={NO_REFS} headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Hi' })).toBeInTheDocument();
  });

  it('gives only a leading hero the h1', () => {
    render(<Sections sections={[section('hero', { heading: 'One' }), { ...section('hero', { heading: 'Two' }), id: 'h2' }]} refs={NO_REFS} />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['One']);
  });

  describe('design', () => {
    const IMG = 'sp/site/a.jpg';
    const withImage: SectionRefs = { ...NO_REFS, images: { [IMG]: 'https://cdn.test/a.jpg' } };
    const band = (container: HTMLElement) => container.querySelector('section')!;

    it('puts each section on its background tone, plain by default', () => {
      const { container } = render(
        <Sections sections={[section('text', { body: 'a' }), { ...section('text', { body: 'b', tone: 'dark' }), id: 't2' }]} refs={NO_REFS} />,
      );
      expect([...container.querySelectorAll('section')].map((s) => s.dataset.tone)).toEqual(['plain', 'dark']);
    });

    it('sets *words* in headings as an accent', () => {
      render(<Sections sections={[section('text', { heading: 'Find your *calm* here' })]} refs={NO_REFS} headingLevel={2} />);
      const heading = screen.getByRole('heading', { name: 'Find your calm here' });
      expect(heading.querySelector('em')).toHaveTextContent('calm');
    });

    it('renders a hero photo with its description and the small line above the heading', () => {
      const { container } = render(
        <Sections sections={[section('hero', { eyebrow: 'Online course', heading: 'Hi', image: IMG, imageAlt: 'Teacher on a mat', layout: 'overlay' })]} refs={withImage} />,
      );
      expect(screen.getByRole('img', { name: 'Teacher on a mat' })).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('https://cdn.test/a.jpg')));
      expect(screen.getByText('Online course')).toBeInTheDocument();
      expect(band(container).dataset.layout).toBe('overlay');
    });

    it('drops the photo when its path has no URL', () => {
      render(<Sections sections={[section('hero', { heading: 'Hi', image: 'sp/site/gone.jpg', layout: 'split' })]} refs={NO_REFS} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Hi' })).toBeInTheDocument();
    });

    it('renders image and text on the chosen side with its button', () => {
      const { container } = render(
        <Sections sections={[section('imageText', { heading: 'Why', body: 'Because', image: IMG, imageAlt: 'Room', side: 'right', ctaLabel: 'More', ctaHref: '/more' })]} refs={withImage} />,
      );
      expect(screen.getByRole('img', { name: 'Room' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
      expect(band(container).dataset.side).toBe('right');
    });

    it('renders an about-me section with photo and signature', () => {
      render(<Sections sections={[section('bio', { heading: 'Hi, I am Ana', body: 'I teach.', image: IMG, imageAlt: 'Ana', signature: 'Ana' })]} refs={withImage} />);
      expect(screen.getByRole('img', { name: 'Ana' })).toBeInTheDocument();
      expect(screen.getByText('I teach.')).toBeInTheDocument();
      expect(screen.getByText('Ana', { selector: 'p' })).toBeInTheDocument();
    });

    it('renders cards with their links', () => {
      render(
        <Sections
          sections={[section('cards', { heading: 'Courses' }, [{ title: 'Basics', body: 'Start here', href: '/basics', image: IMG, imageAlt: 'Mat' }, { title: 'Next' }])]}
          refs={withImage}
        />,
      );
      expect(screen.getByRole('link', { name: /Basics/ })).toHaveAttribute('href', '/basics');
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });

    it('renders highlights as a list', () => {
      render(<Sections sections={[section('highlights', { heading: 'You get' }, [{ text: 'Videos' }, { text: 'Live calls' }])]} refs={NO_REFS} />);
      expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Videos', 'Live calls']);
    });
  });
});
