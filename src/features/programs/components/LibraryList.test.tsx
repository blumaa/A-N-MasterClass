import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/data/types';
import type { LibraryItem } from '../api/library';
import { LibraryList } from './LibraryList';

const program: Product = {
  id: 'p', spaceId: 's', kind: 'program', slug: 'floorwork', title: 'Floorwork', subtitle: 'Ten weeks',
  status: 'published', position: 0, themeOverride: null, certificates: false, coverPath: 's/site/c.jpg',
};
const item = (over: Partial<LibraryItem> = {}): LibraryItem => ({
  program, completed: 3, total: 10, continueStepId: 'st4', hasAccess: true, ...over,
});
const imageSrc = (path: string) => `https://files.test/${path}`;

describe('LibraryList', () => {
  it('shows each program as a card with its cover', () => {
    const { container } = render(<LibraryList items={[item()]} imageSrc={imageSrc} />);
    expect(screen.getByRole('list', { name: 'Programs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Floorwork' })).toBeInTheDocument();
    expect(container.querySelector('img')?.getAttribute('src')).toContain('files.test');
  });

  it('spells out progress so it reads without the bar', () => {
    render(<LibraryList items={[item()]} imageSrc={imageSrc} />);
    expect(screen.getByText('3 of 10 lessons · 30%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/programs/floorwork/st4');
  });

  it('offers Start before the first lesson', () => {
    render(<LibraryList items={[item({ completed: 0 })]} imageSrc={imageSrc} />);
    expect(screen.getByRole('link', { name: 'Start' })).toBeInTheDocument();
  });

  it('shows no progress for programs the viewer does not hold', () => {
    render(<LibraryList items={[item({ hasAccess: false })]} imageSrc={imageSrc} />);
    expect(screen.queryByText(/lessons/)).toBeNull();
    expect(screen.getByRole('link', { name: 'View program' })).toHaveAttribute('href', '/programs/floorwork');
  });

  it('says so when there are no programs', () => {
    render(<LibraryList items={[]} imageSrc={imageSrc} />);
    expect(screen.getByText('No programs yet')).toBeInTheDocument();
  });
});
