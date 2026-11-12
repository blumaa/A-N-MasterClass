import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionLayout } from './SectionLayout';

const nav = (
  <nav aria-label="Section">
    <a href="#one">One</a>
  </nav>
);

describe('SectionLayout', () => {
  it('shows the nav beside the content', () => {
    render(
      <SectionLayout label="Studio" nav={nav}>
        <p>Body</p>
      </SectionLayout>,
    );
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'One' })).toBeInTheDocument();
  });

  it('has a phone button named after the section', () => {
    render(
      <SectionLayout label="Lounge" nav={nav}>
        <p>Body</p>
      </SectionLayout>,
    );
    expect(screen.getByRole('button', { name: 'Lounge' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the nav in a sheet and closes it when a link is picked', () => {
    render(
      <SectionLayout label="Studio" nav={nav}>
        <p>Body</p>
      </SectionLayout>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Studio' }));
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('link', { name: 'One' }));
    expect(screen.getByRole('button', { name: 'Studio', hidden: true })).toHaveAttribute('aria-expanded', 'false');
  });
});
