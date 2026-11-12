import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Meetup } from '@/lib/data/types';
import { zonedToUtc } from '@/lib/format/zoned';
import type { StudioSession } from '../api/meetupSessions';
import { MeetupEditor } from './MeetupEditor';
import { MeetupSessions } from './MeetupSessions';

vi.mock('../eventsActions', () => ({ editEventsAction: vi.fn() }));

const berlin = (local: string) => zonedToUtc(local, 'Europe/Berlin')!;
const meetup: Meetup = {
  id: 'm1',
  communityId: 'c1',
  accessGroupId: 'g1',
  channelId: null,
  title: 'Q&A',
  description: '',
  location: 'https://zoom.us/j/1',
  timeZone: 'Europe/Berlin',
  startsAt: berlin('2026-11-04T19:00'),
  endsAt: berlin('2026-11-04T20:00'),
  replayVimeoId: null,
  repeat: { freq: 'weekly', every: 1, days: [5], count: 6, until: null },
  createdAt: berlin('2026-11-01T00:00'),
};
const session = (n: number, over: Partial<StudioSession> = {}): StudioSession => ({
  n,
  key: n === 0 ? 'm1' : `m1_${n}`,
  title: 'Q&A',
  description: '',
  startsAt: berlin('2026-11-06T19:00'),
  endsAt: berlin('2026-11-06T20:00'),
  replayVimeoId: null,
  cancelled: false,
  rsvpCount: 2,
  ...over,
});

describe('MeetupSessions', () => {
  it('lists events in the meetup zone with scoped edit and cancel; cancelled ones are read-only', () => {
    render(<MeetupSessions meetup={meetup} past={[session(0)]} upcoming={[session(1), session(2, { cancelled: true })]} />);
    expect(screen.getByText('Repeats: Weekly on Wed, Fri, 6 times. Times are in Europe/Berlin.')).toBeInTheDocument();
    const [first, cancelled] = within(screen.getByRole('list', { name: 'Upcoming events' })).getAllByRole('listitem');
    const row = within(first!);
    expect(row.getByLabelText('Starts (Europe/Berlin)')).toHaveValue('2026-11-06T19:00');
    expect(row.getAllByLabelText('Apply to')).toHaveLength(2);
    expect(row.getByRole('button', { name: 'Cancel event' })).toBeInTheDocument();
    expect(within(cancelled!).getByText('Cancelled')).toBeInTheDocument();
    expect(within(cancelled!).queryByRole('button')).toBeNull();
    expect(screen.getByRole('list', { name: 'Past events' })).toBeInTheDocument();
  });

  it('a one-off has no scope choice', () => {
    const { container } = render(<MeetupSessions meetup={{ ...meetup, repeat: null }} past={[]} upcoming={[session(0)]} />);
    expect(screen.queryByLabelText('Apply to')).toBeNull();
    expect(container.querySelector('input[name="scope"]')).toHaveValue('all');
  });
});

describe('MeetupEditor', () => {
  it('prefills the repeat and links to the events of a series', () => {
    render(<MeetupEditor communityId="c1" groups={[]} channels={[]} meetups={[{ ...meetup, rsvpCount: 4 }]} />);
    const row = within(screen.getByRole('list', { name: 'Meetups' }));
    expect(row.getByLabelText('Repeat')).toHaveValue('weekly');
    expect(row.getByLabelText('Repeat ends')).toHaveValue('count');
    expect(row.getByLabelText('Number of times')).toHaveValue(6);
    expect(row.getByRole('checkbox', { name: 'Fri' })).toBeChecked();
    expect(row.getByRole('checkbox', { name: 'Mon' })).not.toBeChecked();
    expect(row.getByRole('link', { name: 'Events in this series' })).toHaveAttribute('href', '/studio/communities/c1/events/m1');
    expect(row.queryByText('4 going')).toBeNull();
  });
});
