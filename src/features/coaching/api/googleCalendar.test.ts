import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { GoogleApiError } from '@/lib/google/calendar';
import { googleCalendarPort } from './googleCalendar';

const NOW = new Date('2026-11-10T12:00:00Z');
const START = new Date('2026-11-11T08:00:00Z');
let repo: FakeRepo;

function fakeGoogle() {
  return {
    accessToken: vi.fn(async () => 'tok'),
    freeBusy: vi.fn(async () => [{ start: START, end: NOW }]),
    insertEvent: vi.fn(async () => 'evt-new'),
    patchEvent: vi.fn(async () => {}),
    deleteEvent: vi.fn(async () => {}),
  };
}

const connect = () =>
  repo.saveCalendarConnection(
    { spaceId: SEED_IDS.alexander, provider: 'google', accountEmail: 'coach@example.test', calendarId: 'primary', connectedAt: NOW },
    'refresh-1',
  );

const booked = () =>
  repo.createCoachingSession({
    productId: SEED_IDS.coaching,
    spaceId: SEED_IDS.alexander,
    clientId: SEED_IDS.student,
    title: 'Private Coaching',
    startsAt: START,
    endsAt: new Date(START.getTime() + 3_600_000),
    agenda: 'knots',
    location: 'https://meet.example.test/a',
    createdAt: NOW,
  });

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

describe('googleCalendarPort', () => {
  it('does nothing without a connection', async () => {
    const google = fakeGoogle();
    const port = googleCalendarPort(repo, google);
    expect(await port.busy(SEED_IDS.alexander, NOW, START)).toEqual([]);
    expect(await port.sync(await booked())).toBeNull();
    expect(google.accessToken).not.toHaveBeenCalled();
  });

  it('reads busy time with a fresh access token', async () => {
    await connect();
    const google = fakeGoogle();
    await googleCalendarPort(repo, google).busy(SEED_IDS.alexander, NOW, START);
    expect(google.accessToken).toHaveBeenCalledWith('refresh-1');
    expect(google.freeBusy).toHaveBeenCalledWith('tok', 'primary', NOW, START);
  });

  it('inserts with the client name, patches when synced, re-inserts when gone', async () => {
    await connect();
    const google = fakeGoogle();
    const port = googleCalendarPort(repo, google);
    const s = await booked();
    expect(await port.sync(s)).toBe('evt-new');
    expect(google.insertEvent).toHaveBeenCalledWith('tok', 'primary', {
      summary: 'Private Coaching with Robin (student)',
      description: 'knots\n\nhttps://meet.example.test/a',
      location: 'https://meet.example.test/a',
      start: s.startsAt,
      end: s.endsAt,
    });
    expect(await port.sync({ ...s, googleEventId: 'evt-1' })).toBe('evt-1');
    expect(google.patchEvent).toHaveBeenCalledOnce();
    google.patchEvent.mockRejectedValueOnce(new GoogleApiError(404, 'notFound'));
    expect(await port.sync({ ...s, googleEventId: 'evt-1' })).toBe('evt-new');
    google.patchEvent.mockRejectedValueOnce(new GoogleApiError(500, null));
    await expect(port.sync({ ...s, googleEventId: 'evt-1' })).rejects.toThrow(GoogleApiError);
  });

  it('deletes the event of a cancelled session, already gone counts as done', async () => {
    await connect();
    const google = fakeGoogle();
    const port = googleCalendarPort(repo, google);
    const s = { ...(await booked()), status: 'cancelled' as const, googleEventId: 'evt-1' };
    expect(await port.sync(s)).toBeNull();
    google.deleteEvent.mockRejectedValueOnce(new GoogleApiError(410, 'deleted'));
    expect(await port.sync(s)).toBeNull();
    google.deleteEvent.mockRejectedValueOnce(new GoogleApiError(503, null));
    await expect(port.sync(s)).rejects.toThrow(GoogleApiError);
  });
});
