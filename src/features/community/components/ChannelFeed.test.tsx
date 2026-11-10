import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ALL_GROUP_FEATURES, type Channel, type Product } from '@/lib/data/types';
import type { CommunityPage } from '../api/feed';
import { ChannelChat } from './ChannelChat';
import { ChannelFeed } from './ChannelFeed';

type Open = Extract<CommunityPage, { kind: 'open' }>;

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
const channel = (over: Partial<Channel> = {}): Channel => ({
  id: 'ch1',
  communityId: 'c1',
  accessGroupId: 'g1',
  title: 'News',
  kind: 'feed',
  privacy: 'public',
  readOnly: false,
  position: 0,
  ...over,
});

const page = (over: Partial<Open>): Open => ({
  kind: 'open',
  community,
  access: { read: true, staff: false, moderatePosts: false, moderateComments: false, groupIds: ['g1'], ...ALL_GROUP_FEATURES },
  channels: [channel()],
  channel: channel(),
  canPost: false,
  posts: [],
  messages: [],
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
    render(<ChannelFeed page={page({ channel: channel({ readOnly: true }) })} action={action} signedIn />);
    expect(screen.queryByLabelText('Write in News')).toBeNull();
    expect(screen.getByText('Only staff post in this channel.')).toBeTruthy();
  });
});

describe('ChannelChat', () => {
  const chat = channel({ kind: 'chat', title: 'Lounge' });
  const line = {
    id: 'm1',
    body: 'hello',
    author: { id: 'p1', name: 'Robin' },
    createdAt: new Date('2026-11-10T12:00:00Z'),
    canDelete: true,
  };

  it('lists messages with delete where allowed, and a send box', () => {
    render(<ChannelChat page={page({ channel: chat, canPost: true, messages: [line] })} action={action} />);
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('Robin')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByLabelText('Message Lounge')).toBeTruthy();
  });

  it('read-only chat: no send box', () => {
    render(<ChannelChat page={page({ channel: { ...chat, readOnly: true }, messages: [] })} action={action} />);
    expect(screen.queryByLabelText('Message Lounge')).toBeNull();
    expect(screen.getByText('No messages yet')).toBeTruthy();
    expect(screen.getByText('Only staff send in this channel.')).toBeTruthy();
  });
});
