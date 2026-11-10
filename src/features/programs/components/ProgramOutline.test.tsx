import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Outline } from '../api/outline';
import { ProgramOutline } from './ProgramOutline';

const NOW = new Date('2026-11-10T12:00:00Z');
const program = { id: 'p', spaceId: 's', kind: 'program', slug: 'shibari-101', title: 'Shibari 101', subtitle: null, status: 'published', position: 0 } as const;

const outline: Outline = {
  program,
  completed: 1,
  total: 3,
  continueStepId: 'b',
  hasAccess: true,
  isEditor: false,
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
  expect(screen.getByText('Safety').closest('li')).toHaveAttribute('aria-current', 'page');
});
