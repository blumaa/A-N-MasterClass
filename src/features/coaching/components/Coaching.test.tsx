import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/data/types';
import type { ClientCoaching as Data, ClientSession } from '../api/booking';
import { ClientCoaching } from './ClientCoaching';
import { ClientSessionDetail } from './ClientSessionDetail';

vi.mock('../actions', () => ({ editCoachingAction: vi.fn(), bookingAction: vi.fn() }));

const NOW = new Date('2026-11-10T12:00:00Z');
const WED_9 = new Date('2026-11-11T08:00:00Z');
const product = { id: 'p1', slug: 'private-coaching', title: 'Private Coaching', subtitle: null } as Product;
const session = (over: Partial<ClientSession> = {}): ClientSession => ({
  id: 's1',
  productId: 'p1',
  spaceId: 'sp',
  clientId: 'me',
  title: 'Private Coaching',
  startsAt: WED_9,
  endsAt: new Date(WED_9.getTime() + 3_600_000),
  agenda: '',
  location: 'https://meet.example.test/a',
  status: 'scheduled',
  cancelledAt: null,
  createdAt: NOW,
  changeable: true,
  ...over,
});
const data = (over: Partial<Data> = {}): Data => ({
  product,
  program: { productId: 'p1', kind: 'one_on_one', sessionMinutes: 60, sessionsIncluded: 3, location: null },
  settings: { timeZone: 'Europe/Berlin', cancelCutoffHours: 24 },
  hasAccess: true,
  isEditor: false,
  upcoming: [],
  past: [],
  remaining: 3,
  slots: [WED_9],
  calendarDown: false,
  ...over,
});

describe('ClientCoaching', () => {
  it('offers open slots in the coach zone with the balance', () => {
    render(<ClientCoaching data={data()} />);
    expect(screen.getByText(/3 of 3 sessions left/)).toBeInTheDocument();
    expect(screen.getByLabelText('Time (Europe/Berlin)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /09:00/ })).toHaveValue(WED_9.toISOString());
    expect(screen.getByRole('button', { name: 'Book' })).toBeInTheDocument();
  });

  it('fails closed while the calendar is down, and tells non-holders they lack access', () => {
    const { unmount } = render(<ClientCoaching data={data({ calendarDown: true, slots: [] })} />);
    expect(screen.getByRole('status')).toHaveTextContent(/cannot be checked/);
    expect(screen.queryByRole('button', { name: 'Book' })).toBeNull();
    unmount();
    render(<ClientCoaching data={data({ hasAccess: false, remaining: 0, slots: [] })} />);
    expect(screen.getByText(/do not have access/)).toBeInTheDocument();
  });
});

describe('ClientSessionDetail', () => {
  const props = { product, timeZone: 'Europe/Berlin', cutoffHours: 24, reschedule: { slots: [WED_9], calendarDown: false } };

  it('links join + calendar file and offers move/cancel while changeable', () => {
    render(<ClientSessionDetail {...props} session={session()} />);
    expect(screen.getByRole('link', { name: 'Join session' })).toHaveAttribute('href', 'https://meet.example.test/a');
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute('href', '/coaching/private-coaching/sessions/s1/session.ics');
    expect(screen.getByRole('button', { name: 'Move session' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel session' })).toBeInTheDocument();
  });

  it('explains the cutoff once the session can no longer change', () => {
    render(<ClientSessionDetail {...props} session={session({ changeable: false })} />);
    expect(screen.queryByRole('button', { name: 'Cancel session' })).toBeNull();
    expect(screen.getByText(/until 24 hours before/)).toBeInTheDocument();
  });
});
