import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PostItem } from '../api/feed';
import { PostCard } from './PostCard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../reportActions', () => ({ reportAction: vi.fn() }));
vi.mock('../uploadActions', () => ({ communityUploadAction: vi.fn() }));

const post = (over: Partial<PostItem> = {}): PostItem => ({
  id: 'p1',
  channelId: 'ch1',
  body: 'hello',
  author: { id: 'u1', name: 'Robin' },
  createdAt: new Date('2026-11-10T12:00:00Z'),
  pinned: false,
  hidden: false,
  locked: false,
  status: 'published',
  reactions: [],
  commentCount: 0,
  canDelete: false,
  mine: false,
  photos: [],
  ...over,
});

const action = vi.fn();
const fieldsOf = (button: HTMLElement): Record<string, string> =>
  Object.fromEntries(new FormData(button.closest('form')!).entries()) as Record<string, string>;

describe('PostCard', () => {
  it('moderators lock and unlock', () => {
    const { rerender } = render(<PostCard post={post()} action={action} href="#x" moderate signedIn />);
    expect(fieldsOf(screen.getByRole('button', { name: 'Lock' }))).toMatchObject({ op: 'lockPost', postId: 'p1', locked: 'true' });
    rerender(<PostCard post={post({ locked: true })} action={action} href="#x" moderate signedIn />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(fieldsOf(screen.getByRole('button', { name: 'Unlock' }))).toMatchObject({ locked: 'false' });
  });

  it('members see the Locked badge but no lock button', () => {
    render(<PostCard post={post({ locked: true })} action={action} href="#x" moderate={false} signedIn />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlock' })).toBeNull();
  });

  it('marks pending and rejected posts for their author', () => {
    const { rerender } = render(<PostCard post={post({ status: 'pending', mine: true })} action={action} href="#x" moderate={false} signedIn />);
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
    rerender(<PostCard post={post({ status: 'rejected', mine: true })} action={action} href="#x" moderate={false} signedIn />);
    expect(screen.getByText('Not approved')).toBeInTheDocument();
  });

  it('moderators approve or reject a pending post; a rejected one can still be approved', () => {
    const { rerender } = render(<PostCard post={post({ status: 'pending' })} action={action} href="#x" moderate signedIn />);
    expect(fieldsOf(screen.getByRole('button', { name: 'Approve' }))).toMatchObject({ op: 'reviewPost', postId: 'p1', decision: 'approve' });
    expect(fieldsOf(screen.getByRole('button', { name: 'Reject' }))).toMatchObject({ decision: 'reject' });
    rerender(<PostCard post={post({ status: 'rejected' })} action={action} href="#x" moderate signedIn />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });
});
