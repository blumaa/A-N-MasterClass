import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SiteFooter } from './SiteFooter';

it('lists footer links then the pinned legal pages', () => {
  render(
    <SiteFooter
      spaceName="Alexander"
      links={[{ label: 'Contact', href: '/contact' }]}
      legal={[{ label: 'Legal notice', href: '/imprint' }]}
    />,
  );
  expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Contact', 'Legal notice']);
  expect(screen.getByRole('navigation', { name: 'Legal' })).toBeInTheDocument();
});

it('renders no empty navs', () => {
  render(<SiteFooter spaceName="Alexander" links={[]} legal={[]} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.getByText(/Alexander/)).toBeInTheDocument();
});
