import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DmThreadPage, InboxItem } from '../api/dms';
import { DmInbox } from './DmInbox';
import { DmThread } from './DmThread';
import { MemberList } from './MemberList';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../uploadActions', () => ({ communityUploadAction: vi.fn() }));

const action = vi.fn();
const AT = new Date('2026-11-10T12:00:00Z');

describe('DmInbox', () => {
  it('links each thread, marks unread and shows the last line', () => {
    const items: InboxItem[] = [
      { id: 't1', other: { id: 'p1', name: 'Robin' }, last: { body: 'hello', createdAt: AT, mine: false }, unread: true },
      { id: 't2', other: { id: 'p2', name: 'Kim' }, last: { body: 'bye', createdAt: AT, mine: true }, unread: false },
    ];
    render(<DmInbox community="circle" items={items} />);
    expect(screen.getByRole('link', { name: /Robin/ })).toHaveAttribute('href', '/community/circle/messages/t1');
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('You: bye')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    render(<DmInbox community="circle" items={[]} />);
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });
});

describe('DmThread', () => {
  const page = (over: Partial<DmThreadPage> = {}): DmThreadPage => ({
    threadId: 't1',
    other: { id: 'p1', name: 'Robin' },
    messages: [{ id: 'm1', body: 'hi there', author: { id: 'p1', name: 'Robin' }, createdAt: AT, canDelete: false, mine: false, attachment: null }],
    canSend: true,
    blocking: false,
    ...over,
  });

  it('shows lines, the send box and a block button', () => {
    render(<DmThread communityId="c1" page={page()} action={action} />);
    expect(screen.getByText('hi there')).toBeInTheDocument();
    expect(screen.getByLabelText('Message Robin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Block' })).toBeInTheDocument();
  });

  it('blocked: no send box, unblock button', () => {
    render(<DmThread communityId="c1" page={page({ canSend: false, blocking: true })} action={action} />);
    expect(screen.queryByLabelText('Message Robin')).toBeNull();
    expect(screen.getByRole('button', { name: 'Unblock' })).toBeInTheDocument();
    expect(screen.getByText('You cannot send messages in this conversation.')).toBeInTheDocument();
  });
});

describe('MemberList', () => {
  it('offers Message only for DM targets', () => {
    const members = [
      { id: 'p1', name: 'Robin', staff: false },
      { id: 'p2', name: 'Kim', staff: true },
    ];
    render(<MemberList members={members} dm={{ communityId: 'c1', targets: ['p2'], action }} />);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).queryByRole('button', { name: 'Message' })).toBeNull();
    expect(within(rows[1]!).getByRole('button', { name: 'Message' })).toBeInTheDocument();
  });
});
