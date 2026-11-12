import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ALL_GROUP_FEATURES, DEFAULT_COMMUNITY_SETTINGS, type Channel, type Product } from '@/lib/data/types';
import type { StudioCommunity } from '../api/studio';
import { CommunityEditor } from './CommunityEditor';
import { CommunityList } from './CommunityList';

vi.mock('../actions', () => ({ editCommunityAction: vi.fn() }));

const community: Product = {
  id: 'c1',
  spaceId: 's',
  kind: 'community',
  slug: 'circle',
  title: 'Circle',
  subtitle: null,
  status: 'draft',
  position: 0,
  themeOverride: null,
};
const channel = (id: string, title: string, position: number, over: Partial<Channel> = {}): Channel => ({
  id,
  communityId: 'c1',
  accessGroupId: 'members',
  title,
  kind: 'feed',
  privacy: 'public',
  readOnly: false,
  position,
  ...over,
});

const view = (over: Partial<StudioCommunity> = {}): StudioCommunity => ({
  community,
  channels: [channel('g', 'General', 0), channel('w', 'Wins', 1, { privacy: 'private', kind: 'chat' })],
  groups: [
    { id: 'members', communityId: 'c1', title: 'Members', isDefault: true, ...ALL_GROUP_FEATURES },
    { id: 'vip', communityId: 'c1', title: 'VIP', isDefault: false, ...ALL_GROUP_FEATURES, dms: false },
  ],
  settings: { communityId: 'c1', ...DEFAULT_COMMUNITY_SETTINGS },
  members: [
    { id: 'p1', name: 'Robin', staff: false },
    { id: 'p2', name: 'Kim', staff: false },
  ],
  channelMembers: { w: ['p1'] },
  channelModerators: { g: ['p2'], w: [] },
  staff: [{ profileId: 'a', name: 'Sam', role: 'assistant', ticked: true }],
  canManageStaff: true,
  canModerate: true,
  ...over,
});

/** Channel rows only (rows hold nested member and moderator lists). */
const channelRows = (): HTMLElement[] => [...screen.getByRole('list', { name: 'Channels' }).children] as HTMLElement[];

describe('CommunityList', () => {
  it('links each community to its editor', () => {
    render(<CommunityList communities={[community]} />);
    expect(screen.getByRole('link', { name: /Circle/ })).toHaveAttribute('href', '/studio/communities/c1');
    expect(screen.getByRole('button', { name: 'Add community' })).toBeInTheDocument();
  });
});

describe('CommunityEditor', () => {
  it('shows each channel with move buttons only where it can move', () => {
    render(<CommunityEditor view={view()} />);
    const rows = channelRows();
    expect(within(rows[0]!).queryByRole('button', { name: 'Move up' })).toBeNull();
    expect(within(rows[0]!).getByRole('button', { name: 'Move down' })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('button', { name: 'Move up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add channel' })).toBeInTheDocument();
  });

  it('private channels pick members: picked ones can be removed, the rest added', () => {
    render(<CommunityEditor view={view()} />);
    const rows = channelRows();
    expect(within(rows[0]!).queryByRole('list', { name: 'Members of General' })).toBeNull();
    const picked = within(rows[1]!).getByRole('list', { name: 'Members of Wins' });
    expect(within(picked).getByText('Robin')).toBeInTheDocument();
    expect(within(picked).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    const invite = within(rows[1]!).getByRole('combobox', { name: 'Invite member' });
    expect(within(invite).getAllByRole('option').map((o) => o.textContent)).toEqual(['Kim']);
  });

  it('picks channel moderators from those who read the channel; hidden without community.moderate', () => {
    const { rerender } = render(<CommunityEditor view={view()} />);
    const rows = channelRows();
    const mods = within(rows[0]!).getByRole('list', { name: 'Moderators of General' });
    expect(within(mods).getByText('Kim')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('button', { name: 'Add moderator' })).toBeInTheDocument();
    // Wins is private with Robin picked: only Robin can moderate it.
    expect(within(rows[1]!).getByText('No moderators picked yet.')).toBeInTheDocument();
    const pick = within(rows[1]!).getByRole('combobox', { name: 'Pick moderator' });
    expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['Robin']);
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/studio/communities/c1/reports');
    rerender(<CommunityEditor view={view({ canModerate: false })} />);
    expect(screen.queryByText('No moderators picked yet.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
  });

  it('lists access groups; only non-default groups can be deleted', () => {
    render(<CommunityEditor view={view()} />);
    const groups = within(screen.getByRole('list', { name: 'Access groups' })).getAllByRole('listitem');
    expect(groups).toHaveLength(2);
    expect(within(groups[0]!).getByText('Default')).toBeInTheDocument();
    expect(within(groups[0]!).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(groups[1]!).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save messaging' })).toBeInTheDocument();
  });

  it('shows staff ticks only with staff.manage', () => {
    const { rerender } = render(<CommunityEditor view={view()} />);
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove access' })).toBeInTheDocument();
    rerender(<CommunityEditor view={view({ canManageStaff: false })} />);
    expect(screen.queryByText('Sam')).toBeNull();
  });
});
