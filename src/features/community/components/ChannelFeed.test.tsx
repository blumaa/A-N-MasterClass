import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Channel, Product } from '@/lib/data/types';
import type { CommunityPage } from '../api/feed';
import { ChannelFeed } from './ChannelFeed';

type Open = Extract<CommunityPage, { kind: 'open' }>;

const community: Product = {
  id: 'c1',
  spaceId: 's',
  kind: 'community',
  slug: 'circle',
  title: 'Circle',
  subtitle: null,
  status: 'published',
  position: 0,
  themeOverride: null,
};
const channel = (visibility: Channel['visibility']): Channel => ({ id: 'ch1', communityId: 'c1', title: 'News', visibility, position: 0 });

const page = (over: Partial<Open>): Open => ({
  kind: 'open',
  community,
  access: { read: true, moderatePosts: false, moderateComments: false },
  channels: [channel('public')],
  channel: channel('public'),
  canPost: false,
  posts: [],
  members: [],
  ...over,
});

const action = vi.fn();

describe('ChannelFeed', () => {
  it('shows the composer when the viewer may post', () => {
    render(<ChannelFeed page={page({ canPost: true })} action={action} signedIn />);
    expect(screen.getByLabelText('Write in News')).toBeTruthy();
    expect(screen.getByText('No posts yet')).toBeTruthy();
  });

  it('explains read-only channels instead of a composer', () => {
    render(<ChannelFeed page={page({ channel: channel('read_only') })} action={action} signedIn />);
    expect(screen.queryByLabelText('Write in News')).toBeNull();
    expect(screen.getByText('Only staff post in this channel.')).toBeTruthy();
  });
});
