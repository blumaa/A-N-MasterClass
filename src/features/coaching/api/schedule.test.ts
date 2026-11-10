import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { DEFAULT_RULES } from '@/lib/scheduling/slots';
import { loadSchedule, NO_CALENDAR, openSlots, outOfSync, syncToCalendar, type CalendarPort } from './schedule';

// Tuesday 2026-11-10 12:00 UTC. Seeded coach: Europe/Berlin, Mon-Fri 9-17, buffer after 15,
// notice 12h, window 14 days.
const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
const group = (startsAt: Date) => ({
  productId: SEED_IDS.coaching,
  spaceId: SEED_IDS.alexander,
  clientId: null,
  title: 'Group',
  startsAt,
  endsAt: new Date(startsAt.getTime() + 3_600_000),
  agenda: '',
  location: null,
  createdAt: NOW,
});

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

describe('loadSchedule', () => {
  it('uses stored settings and rules', async () => {
    const s = await loadSchedule(repo, SEED_IDS.alexander);
    expect(s).toMatchObject({ timeZone: 'Europe/Berlin', bufferAfterMin: 15, minNoticeMin: 720, windowDays: 14 });
    expect(s.rules.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5]);
  });

  it('falls back to defaults before the coach saves settings', async () => {
    const s = await loadSchedule(repo, SEED_IDS.natasha);
    expect(s).toMatchObject({ timeZone: 'UTC', bufferBeforeMin: 0, minNoticeMin: 240, windowDays: 14 });
    expect(s.rules).toEqual(DEFAULT_RULES);
  });

  it('drops the default hours once the coach adds a window', async () => {
    await repo.createAvailabilityRule({ spaceId: SEED_IDS.natasha, weekday: 6, startMinute: 600, endMinute: 660 });
    const s = await loadSchedule(repo, SEED_IDS.natasha);
    expect(s.rules.map((r) => r.weekday)).toEqual([6]);
  });
});

describe('openSlots', () => {
  it('starts after minimum notice in the coach zone', async () => {
    const { slots } = await openSlots(repo, NO_CALENDAR, SEED_IDS.alexander, 60, NOW);
    // Notice ends Wed 00:00 UTC = 01:00 Berlin; first window Wed 09:00 Berlin = 08:00 UTC.
    expect(slots[0]!.toISOString()).toBe('2026-11-11T08:00:00.000Z');
  });

  it('treats scheduled sessions and calendar busy time as blocked, except the one being moved', async () => {
    const s = await repo.createCoachingSession(group(new Date('2026-11-11T08:00:00Z')));
    const google: CalendarPort = {
      ...NO_CALENDAR,
      busy: async () => [{ start: new Date('2026-11-11T09:30:00Z'), end: new Date('2026-11-11T11:00:00Z') }],
    };
    const first = async (except: string | null) =>
      (await openSlots(repo, google, SEED_IDS.alexander, 30, NOW, except)).slots.slice(0, 2).map((d) => d.toISOString());
    // Session 08-09 + 15 min buffer after; Google 09:30-11:00.
    expect(await first(null)).toEqual(['2026-11-11T11:00:00.000Z', '2026-11-11T11:30:00.000Z']);
    expect(await first(s.id)).toEqual(['2026-11-11T08:00:00.000Z', '2026-11-11T08:30:00.000Z']);
  });

  it('ignores the Google copy of the session being moved', async () => {
    const s = await repo.createCoachingSession(group(new Date('2026-11-11T08:00:00Z')));
    const mirror: CalendarPort = { ...NO_CALENDAR, busy: async () => [{ start: s.startsAt, end: s.endsAt }] };
    const { slots } = await openSlots(repo, mirror, SEED_IDS.alexander, 60, NOW, s.id);
    expect(slots[0]!.toISOString()).toBe('2026-11-11T08:00:00.000Z');
  });

  it('propagates a calendar failure', async () => {
    const down: CalendarPort = { ...NO_CALENDAR, busy: async () => Promise.reject(new Error('google 503')) };
    await expect(openSlots(repo, down, SEED_IDS.alexander, 60, NOW)).rejects.toThrow('google 503');
  });
});

describe('syncToCalendar', () => {
  it('stores the event id, and keeps the row when Google fails', async () => {
    const s = await repo.createCoachingSession(group(new Date('2026-11-11T08:00:00Z')));
    await syncToCalendar(repo, { ...NO_CALENDAR, sync: async () => 'evt-1' }, s);
    expect((await repo.coachingSession(s.id))!.googleEventId).toBe('evt-1');

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cancelled = await repo.updateCoachingSession(s.id, { status: 'cancelled', cancelledAt: NOW });
    await syncToCalendar(repo, { ...NO_CALENDAR, sync: () => Promise.reject(new Error('google 503')) }, cancelled);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
    const row = (await repo.coachingSession(s.id))!;
    expect(row.googleEventId).toBe('evt-1');
    expect(outOfSync(row, true)).toBe(true);
    expect(outOfSync(row, false)).toBe(false);
  });
});
