import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ALL_GROUP_FEATURES, type Channel, type Product } from '@/lib/data/types';
import type { CommunityPage } from '../api/feed';
import { ChannelChat } from './ChannelChat';
import { ChannelFeed } from './ChannelFeed';

type Open = Extract<CommunityPage, { kind: 'open' }>;

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../reportActions', () => ({ reportAction: vi.fn() }));

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
  rules: { read: true, post: false, moderatePosts: false, moderateComments: false },
  posts: [],
  messages: [],
  members: [],
  ...over,
});

const action = vi.fn();

describe('ChannelFeed', () => {
  it('shows the composer when the viewer may post', () => {
    render(<ChannelFeed page={page({ rules: { read: true, post: true, moderatePosts: false, moderateComments: false } })} action={action} signedIn />);
    expect(screen.getByLabelText('Write in News')).toBeTruthy();
    expect(screen.getByText('No posts yet')).toBeTruthy();
  });

  it('offers Report on posts by others to signed-in viewers', () => {
    const post = {
      id: 'p1',
      channelId: 'ch1',
      body: 'hello',
      author: { id: 'u1', name: 'Robin' },
      createdAt: new Date('2026-11-10T12:00:00Z'),
      pinned: false,
      hidden: false,
      reactions: [],
      commentCount: 0,
      canDelete: false,
      mine: false,
      photos: [],
    };
    const posts = [post, { ...post, id: 'p2', mine: true }];
    const { rerender } = render(<ChannelFeed page={page({ posts })} action={action} signedIn />);
    expect(screen.getAllByText('Report')).toHaveLength(1);
    rerender(<ChannelFeed page={page({ posts })} action={action} signedIn={false} />);
    expect(screen.queryByText('Report')).toBeNull();
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
    mine: false,
    attachment: null,
  };

  it('lists messages with delete and report where allowed, and a send box', () => {
    render(<ChannelChat page={page({ channel: chat, rules: { read: true, post: true, moderatePosts: false, moderateComments: false }, messages: [line, { ...line, id: 'm2', body: 'mine', author: { id: 'p2', name: 'Me' }, mine: true }] })} action={action} signedIn />);
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('Robin')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
    expect(screen.getAllByText('Report')).toHaveLength(1);
    expect(screen.getByLabelText('Message Lounge')).toBeTruthy();
  });

  it('read-only chat: no send box', () => {
    render(<ChannelChat page={page({ channel: { ...chat, readOnly: true }, messages: [] })} action={action} signedIn={false} />);
    expect(screen.queryByLabelText('Message Lounge')).toBeNull();
    expect(screen.getByText('No messages yet')).toBeTruthy();
    expect(screen.getByText('Only staff send in this channel.')).toBeTruthy();
  });
});
