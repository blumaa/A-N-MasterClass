import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Outline } from '../api/outline';
import { ProgramOutline } from './ProgramOutline';

const NOW = new Date('2026-11-10T12:00:00Z');
const program = { id: 'p', spaceId: 's', kind: 'program', slug: 'shibari-101', title: 'Shibari 101', subtitle: null, status: 'published', position: 0, themeOverride: null, certificates: false } as const;

const outline: Outline = {
  program,
  completed: 1,
  total: 3,
  continueStepId: 'b',
  hasAccess: true,
  isEditor: false,
  certificateReady: false,
  modules: [
    {
      id: 'm1', title: 'Welcome', description: null, status: 'published', access: { kind: 'open' }, completed: 1,
      steps: [
        { id: 'a', title: 'Intro', status: 'published', done: true, access: { kind: 'open' } },
        { id: 'b', title: 'Safety', status: 'published', done: false, access: { kind: 'open' } },
      ],
    },
    {
      id: 'm2', title: 'Week two', description: null, status: 'published', completed: 0,
      access: { kind: 'drip', opensAt: new Date('2026-11-13T12:00:00Z') },
      steps: [{ id: 'c', title: 'Together', status: 'published', done: false, access: { kind: 'drip', opensAt: new Date('2026-11-13T12:00:00Z') } }],
    },
  ],
};

it('links open steps, marks done ones and labels drip modules', () => {
  render(<ProgramOutline outline={outline} currentStepId="b" now={NOW} />);
  expect(screen.getByRole('link', { name: 'Safety' })).toHaveAttribute('href', '/programs/shibari-101/b');
  expect(screen.queryByRole('link', { name: 'Together' })).toBeNull();
  expect(screen.getByText('Opens in 3 days')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Complete')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Safety' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Intro' })).not.toHaveAttribute('aria-current');
});

it('shows progress in words, not only as a bar', () => {
  render(<ProgramOutline outline={outline} now={NOW} />);
  expect(screen.getByText('1 of 3 lessons complete · 33%')).toBeVisible();
});

it('states a lock reason as a note, not a badge', () => {
  render(<ProgramOutline outline={outline} now={NOW} />);
  expect(screen.getByText('Opens in 3 days').closest('.mds-Badge__badge')).toBeNull();
});

it('offers the certificate download only when it is earned (G26)', () => {
  const { rerender } = render(<ProgramOutline outline={outline} now={NOW} />);
  expect(screen.queryByRole('link', { name: 'Download certificate' })).toBeNull();
  rerender(<ProgramOutline outline={{ ...outline, certificateReady: true }} now={NOW} />);
  expect(screen.getByRole('link', { name: 'Download certificate' })).toHaveAttribute('href', '/programs/shibari-101/certificate');
});
