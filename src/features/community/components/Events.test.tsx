import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AccessGroup, Challenge } from '@/lib/data/types';
import type { MeetupItem } from '../api/meetups';
import { ChallengeEditor } from './ChallengeEditor';
import { LeaderboardTable } from './Leaderboard';
import { MeetupDetail } from './Meetups';

vi.mock('../eventsActions', () => ({ editEventsAction: vi.fn() }));

const NOW = new Date('2026-11-10T18:00:00Z');
const meetup = (over: Partial<MeetupItem> = {}): MeetupItem => ({
  id: 'm1',
  communityId: 'c1',
  accessGroupId: 'g1',
  channelId: null,
  title: 'Q&A',
  description: '',
  timeZone: 'Europe/Berlin',
  startsAt: NOW,
  endsAt: new Date(NOW.getTime() + 3_600_000),
  replayVimeoId: null,
  repeat: null,
  createdAt: NOW,
  key: 'm1',
  occurrence: 0,
  state: 'upcoming',
  joinUrl: null,
  rsvpCount: 2,
  going: false,
  ...over,
});
const noop = vi.fn(async () => null);

describe('MeetupDetail', () => {
  it('shows the time in the event zone and hides the join link until it opens', () => {
    render(<MeetupDetail community="circle" meetup={meetup()} action={noop} signedIn />);
    expect(screen.getByText(/Nov 10, 2026, 7:00 PM GMT\+1/)).toBeInTheDocument();
    expect(screen.getByText(/join link appears 15 minutes before/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RSVP' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute('href', '/community/circle/meetups/m1/event.ics');
  });

  it('links one occurrence of a repeating meetup and RSVPs to it', () => {
    const repeat = { freq: 'weekly' as const, every: 1, days: [], count: null, until: null };
    const { container } = render(<MeetupDetail community="circle" meetup={meetup({ repeat, key: 'm1_3', occurrence: 3 })} action={noop} signedIn />);
    expect(screen.getByText('Repeats: Weekly on Tue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute('href', '/community/circle/meetups/m1_3/event.ics');
    expect(container.querySelector('input[name="occurrence"]')).toHaveValue('3');
  });

  it('shows the join link when joinable and no RSVP for guests', () => {
    render(<MeetupDetail community="circle" meetup={meetup({ state: 'live', joinUrl: 'https://zoom.us/j/1' })} action={noop} signedIn={false} />);
    expect(screen.getByRole('link', { name: 'Join meetup' })).toHaveAttribute('href', 'https://zoom.us/j/1');
    expect(screen.queryByRole('button', { name: 'RSVP' })).toBeNull();
  });
});

describe('LeaderboardTable', () => {
  it('lists ranks with points, marks the period and the viewer rank', () => {
    const rows = [
      { rank: 1, author: { id: 'a', name: 'Ada' }, points: 5 },
      { rank: 2, author: { id: 'b', name: 'Bo' }, points: 1 },
    ];
    render(<LeaderboardTable community="circle" board={{ period: 'week', rows, mine: { rank: 2, points: 1 } }} />);
    const list = screen.getByRole('list', { name: 'Leaderboard, this week' });
    expect(within(list).getByText('Ada')).toBeInTheDocument();
    expect(within(list).getByText('5 points')).toBeInTheDocument();
    expect(screen.getByText('You are #2 with 1 point.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All time' })).toHaveAttribute('href', expect.stringContaining('/community/circle/leaderboard'));
  });
});

describe('ChallengeEditor', () => {
  it('prefills times in UTC and offers the access groups', () => {
    const group: AccessGroup = { id: 'g1', communityId: 'c1', title: 'Members' } as AccessGroup;
    const c: Challenge = {
      id: 'x1',
      communityId: 'c1',
      accessGroupId: 'g1',
      title: 'Tie a day',
      description: '',
      prize: null,
      startsAt: NOW,
      endsAt: new Date(NOW.getTime() + 86_400_000),
      showBeforeStart: false,
      createdAt: NOW,
    };
    render(<ChallengeEditor communityId="c1" groups={[group]} challenges={[{ ...c, entryCount: 3 }]} />);
    const row = within(screen.getByRole('list', { name: 'Challenges' }));
    expect(row.getByText('3 entries')).toBeInTheDocument();
    expect(row.getByLabelText('Starts')).toHaveValue('2026-11-10T18:00');
    expect(screen.getByRole('option', { name: 'Members' })).toBeInTheDocument();
  });
});
