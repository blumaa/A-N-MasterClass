import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommentNode } from '../api/present';
import { CommentThread } from './CommentThread';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../uploadActions', () => ({ communityUploadAction: vi.fn() }));

const comment: CommentNode = {
  id: 'c1',
  parentId: null,
  body: 'hi',
  author: { id: 'u1', name: 'Robin' },
  createdAt: new Date('2026-11-10T12:00:00Z'),
  hidden: false,
  reactions: [],
  canDelete: false,
  mine: false,
  replies: [],
};

const thread = (closed: boolean) => (
  <CommentThread action={vi.fn()} target={{ type: 'post', id: 'p1' }} comments={[comment]} members={[]} canComment closed={closed} moderate={false} report={vi.fn()} />
);

describe('CommentThread', () => {
  it('open thread: comment and reply composers', () => {
    render(thread(false));
    expect(screen.getByLabelText('Write a comment')).toBeInTheDocument();
    expect(screen.getByLabelText('Reply to Robin')).toBeInTheDocument();
  });

  it('closed thread (locked or unpublished post): no composers, says why', () => {
    render(thread(true));
    expect(screen.queryByLabelText('Write a comment')).toBeNull();
    expect(screen.queryByLabelText('Reply to Robin')).toBeNull();
    expect(screen.getByText('Comments are closed.')).toBeInTheDocument();
    expect(screen.getByText('Report')).toBeInTheDocument();
  });
});
