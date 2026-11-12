import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PostItem } from '../api/feed';
import type { LogItem, Review } from '../api/review';
import { ReviewFeed } from './ReviewFeed';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../reportActions', () => ({ reportAction: vi.fn() }));
vi.mock('../uploadActions', () => ({ communityUploadAction: vi.fn() }));

const community = { id: 'c1', slug: 'circle' } as Review['community'];
const post: PostItem = {
  id: 'p1',
  channelId: 'ch1',
  body: 'wait for me',
  author: { id: 'u1', name: 'Robin' },
  createdAt: new Date('2026-11-10T12:00:00Z'),
  pinned: false,
  hidden: false,
  locked: false,
  status: 'pending',
  reactions: [],
  commentCount: 0,
  canDelete: true,
  mine: false,
  photos: [],
};
const entry: LogItem = {
  id: 'l1',
  actor: 'Sam',
  action: 'lock',
  targetType: 'post',
  channel: 'General',
  preview: 'spam',
  href: '#x',
  createdAt: new Date('2026-11-10T12:00:00Z'),
};

const view = (review: Review) => render(<ReviewFeed review={review} page="#x" action={vi.fn()} />);

describe('ReviewFeed', () => {
  it('tabs link to each view; the current one is marked', () => {
    view({ community, tab: 'reports', queue: { community, reporters: false, open: [], resolved: [] } });
    const tabs = screen.getByRole('navigation', { name: 'Review feed' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Reports', 'Pending', 'Rejected', 'Hidden', 'Locked', 'Log']);
    expect(within(tabs).getByRole('link', { name: 'Hidden' })).toHaveAttribute('href', '#x?tab=hidden');
    expect(within(tabs).getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('No open reports')).toBeInTheDocument();
  });

  it('post tabs show the posts with moderation buttons, or an empty note', () => {
    const { unmount } = view({ community, tab: 'pending', posts: [post] });
    expect(screen.getByText('wait for me')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    unmount();
    view({ community, tab: 'locked', posts: [] });
    expect(screen.getByText('No locked posts')).toBeInTheDocument();
  });

  it('log: filter form and entries', () => {
    view({ community, tab: 'log', filter: { action: 'lock', from: '2026-11-01', to: null }, entries: [entry] });
    const form = screen.getByRole('search', { name: 'Filter log' });
    expect(form).toHaveAttribute('method', 'get');
    expect(within(form).getByLabelText('Action')).toHaveValue('lock');
    expect(within(form).getByLabelText('From')).toHaveValue('2026-11-01');
    expect(within(form).getByLabelText('To')).toHaveValue('');
    const list = screen.getByRole('list', { name: 'Moderation log' });
    expect(list).toHaveTextContent('Sam locked a post in General');
    expect(list).toHaveTextContent('spam');
  });

  it('log: empty', () => {
    view({ community, tab: 'log', filter: { action: null, from: null, to: null }, entries: [] });
    expect(screen.getByText('No moderation yet')).toBeInTheDocument();
  });
});
