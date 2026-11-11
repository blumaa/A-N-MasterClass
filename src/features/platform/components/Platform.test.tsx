import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlatformSpaceDetail } from '../api/spaces';
import { ClaimLink } from './ClaimLink';
import { SpaceDetail } from './SpaceDetail';
import { SpacesTable } from './SpacesTable';

vi.mock('../actions', () => ({ platformAction: vi.fn(), platformClaimAction: vi.fn() }));

const SPACE = { id: 's1', slug: 'fiddle', name: 'Old-Time Fiddle', status: 'draft', locale: 'en', isTest: true } as const;

describe('platform admin UI', () => {
  it('lists spaces with status, test flag and a link to each', () => {
    render(<SpacesTable spaces={[SPACE]} />);
    const row = screen.getByRole('row', { name: /Old-Time Fiddle/ });
    expect(within(row).getByRole('link', { name: 'Old-Time Fiddle' })).toHaveAttribute('href', '/spaces/fiddle');
    expect(within(row).getByText('draft')).toBeInTheDocument();
    expect(within(row).getByText('Test')).toBeInTheDocument();
  });

  it('shows a claim link to copy and where to manage the space', () => {
    render(<ClaimLink slug="fiddle" claimUrl="http://fiddle.localhost:3000/claim/abc" />);
    expect(screen.getByLabelText('Owner sign-in link')).toHaveValue('http://fiddle.localhost:3000/claim/abc');
    expect(screen.getByRole('link', { name: /Manage fiddle/ })).toHaveAttribute('href', '/spaces/fiddle');
  });

  it('shows owners, domains with remove, status and the add-domain form', () => {
    const detail: PlatformSpaceDetail = {
      space: SPACE,
      domains: [{ host: 'fiddle.example.com', spaceId: 's1', isPrimary: true }],
      owners: [{ email: 'ana@example.com', displayName: 'Ana' }],
    };
    render(<SpaceDetail detail={detail} spaceUrl="http://fiddle.localhost:3000" />);
    expect(screen.getByText(/ana@example.com/)).toBeInTheDocument();
    expect(screen.getByText('fiddle.example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('draft');
    expect(screen.getByLabelText('Domain')).toBeRequired();
    expect(screen.getByRole('link', { name: 'http://fiddle.localhost:3000' })).toHaveAttribute('href', 'http://fiddle.localhost:3000');
  });
});
