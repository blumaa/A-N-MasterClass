import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpaceHeader } from './SpaceHeader';

const site = [
  { label: 'Course', href: '/checkout/first' },
  { label: 'About', href: '/about' },
];
const member = {
  displayName: 'Ada Lovelace',
  unread: 2,
  links: [
    { label: 'Library', href: '/library' },
    { label: 'Notifications (2)', href: '/notifications' },
  ],
};
const signOut = <button type="submit">Sign out</button>;

describe('SpaceHeader', () => {
  it('shows the space name and the site links', () => {
    render(<SpaceHeader spaceName="Fiddle" site={site} account={null} signInHref="/login" signOut={null} />);
    expect(screen.getByRole('link', { name: 'Fiddle' })).toHaveAttribute('href', '/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  });

  it('offers sign in to a visitor', () => {
    render(<SpaceHeader spaceName="Fiddle" site={site} account={null} signInHref="/login" signOut={null} />);
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /Ada/ })).not.toBeInTheDocument();
  });

  it('opens the account panel with the member links and sign out', () => {
    render(<SpaceHeader spaceName="Fiddle" site={site} account={member} signInHref={null} signOut={signOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account: Ada Lovelace, 2 unread' }));
    const panel = screen.getByRole('dialog', { name: 'Account' });
    expect(within(panel).getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/library');
    expect(within(panel).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('opens a phone menu with site and account links', () => {
    render(<SpaceHeader spaceName="Fiddle" site={site} account={member} signInHref={null} signOut={signOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(sheet).getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Library' })).toBeInTheDocument();
  });

  it('shows only the name while the space is hidden', () => {
    render(<SpaceHeader spaceName="Fiddle" site={null} account={null} signInHref="/login" signOut={null} />);
    expect(screen.getByText('Fiddle')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
