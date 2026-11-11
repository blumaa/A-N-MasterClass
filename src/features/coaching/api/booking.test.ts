import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { ConstraintError } from '@/lib/data/errors';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { clientCoaching, clientSession, editBooking, myCoaching, rescheduleSlots, sessionIcs, type BookingCommand } from './booking';
import { NO_CALENDAR, type CalendarPort } from './schedule';

// Tuesday 12:00 UTC. Coach: Berlin, Mon-Fri 9-17, 12h notice, 24h cutoff, 60 min sessions, 3 included.
const NOW = new Date('2026-11-10T12:00:00Z');
const WED_9 = new Date('2026-11-11T08:00:00Z'); // 09:00 Berlin, first open slot
const THU_9 = new Date('2026-11-12T08:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;
const run = async (who: string | null, c: BookingCommand, calendar: CalendarPort = NO_CALENDAR, now = NOW) =>
  editBooking(repo, await as(who), calendar, c, now);
const bookWed = (agenda = '') => run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: WED_9, agenda });
const view = async (who: string | null, calendar: CalendarPort = NO_CALENDAR) =>
  clientCoaching(repo, await as(who), calendar, 'private-coaching', NOW);

describe('clientCoaching', () => {
  it('shows a grant holder their balance and open slots in the coach zone', async () => {
    const v = (await view(SEED_IDS.student))!;
    expect(v).toMatchObject({ hasAccess: true, remaining: 3, calendarDown: false, settings: { timeZone: 'Europe/Berlin' } });
    expect(v.slots[0]).toEqual(WED_9);
  });

  it('offers no slots without a grant, and hides unknown or non-coaching slugs', async () => {
    const v = (await view(null))!;
    expect(v).toMatchObject({ hasAccess: false, remaining: 0, slots: [], upcoming: [] });
    expect(await clientCoaching(repo, await as(null), NO_CALENDAR, 'shibari-101', NOW)).toBeNull();
    expect(await clientCoaching(repo, await as(null), NO_CALENDAR, 'nope', NOW)).toBeNull();
  });

  it('fails closed when the calendar is down', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down: CalendarPort = { ...NO_CALENDAR, busy: () => Promise.reject(new Error('google 503')) };
    const v = (await view(SEED_IDS.student, down))!;
    expect(v).toMatchObject({ calendarDown: true, slots: [] });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('lists own and group sessions, never other clients', async () => {
    await bookWed();
    await repo.createCoachingSession({
      productId: SEED_IDS.coaching, spaceId: SEED_IDS.alexander, clientId: null, title: 'Group Q&A',
      startsAt: THU_9, endsAt: new Date(THU_9.getTime() + 3_600_000), agenda: '', location: null, createdAt: NOW,
    });
    await repo.createCoachingSession({
      productId: SEED_IDS.coaching, spaceId: SEED_IDS.alexander, clientId: SEED_IDS.assistant, title: 'Other',
      startsAt: new Date('2026-11-13T08:00:00Z'), endsAt: new Date('2026-11-13T09:00:00Z'), agenda: '', location: null, createdAt: NOW,
    });
    const v = (await view(SEED_IDS.student))!;
    expect(v.upcoming.map((s) => s.title)).toEqual(['Private Coaching', 'Group Q&A']);
    expect(v.upcoming.map((s) => s.changeable)).toEqual([false, false]); // Wed 9 is < 24h away; group is the coach's
    expect(v.remaining).toBe(2);
    expect(v.upcoming[0]).not.toHaveProperty('googleEventId');
  });
});

describe('editBooking', () => {
  it('books an offered slot with the program length and link, then mirrors it to Google', async () => {
    const sync = vi.fn(async () => 'evt-1');
    const result = await run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: WED_9, agenda: ' knots ' }, { ...NO_CALENDAR, sync });
    expect(result).toMatchObject({ ok: true });
    const s = (await repo.coachingSession(result.ok ? result.id! : ''))!;
    expect(s).toMatchObject({
      clientId: SEED_IDS.student,
      endsAt: new Date('2026-11-11T09:00:00Z'),
      agenda: 'knots',
      location: 'https://meet.example.test/alexander',
      googleEventId: 'evt-1',
    });
    expect(sync).toHaveBeenCalledOnce();
  });

  it('refuses a time that is not an open slot', async () => {
    await bookWed();
    expect(await bookWed()).toMatchObject({ ok: false, error: 'invalid', message: expect.stringMatching(/no longer available/) });
    const odd = await run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: new Date('2026-11-11T08:10:00Z'), agenda: '' });
    expect(odd).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('reports a slot lost to a concurrent booking (DB exclusion) as no longer available', async () => {
    vi.spyOn(repo, 'bookCoachingSession').mockRejectedValueOnce(new ConstraintError('overlaps another session'));
    expect(await bookWed()).toMatchObject({ ok: false, error: 'invalid', message: expect.stringMatching(/no longer available/) });
  });

  it('refuses when the calendar cannot be checked', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down: CalendarPort = { ...NO_CALENDAR, busy: () => Promise.reject(new Error('google 503')) };
    const r = await run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: WED_9, agenda: '' }, down);
    expect(r).toMatchObject({ ok: false, error: 'invalid', message: expect.stringMatching(/calendar/) });
    spy.mockRestore();
  });

  it('keeps the booking when Google sync fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: CalendarPort = { ...NO_CALENDAR, sync: () => Promise.reject(new Error('google 503')) };
    const r = await run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: WED_9, agenda: '' }, broken);
    expect(r).toMatchObject({ ok: true });
    expect(repo.db.coachingSessions[0]!.googleEventId).toBeNull();
    spy.mockRestore();
  });

  it('needs a login and a grant', async () => {
    expect(await run(null, { op: 'book', productId: SEED_IDS.coaching, startsAt: WED_9, agenda: '' })).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(SEED_IDS.assistant, { op: 'book', productId: SEED_IDS.coaching, startsAt: WED_9, agenda: '' })).toMatchObject({
      ok: false,
      error: 'invalid',
    });
  });

  it('reschedules and cancels own sessions before the cutoff only', async () => {
    const booked = await run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: THU_9, agenda: '' });
    const id = booked.ok ? booked.id! : '';
    expect(await run(SEED_IDS.student, { op: 'reschedule', sessionId: id, startsAt: WED_9 })).toMatchObject({ ok: true });
    expect((await repo.coachingSession(id))!.endsAt).toEqual(new Date('2026-11-11T09:00:00Z'));
    // Now < 24h before the start.
    expect(await run(SEED_IDS.student, { op: 'cancel', sessionId: id })).toMatchObject({ ok: false, error: 'invalid' });
    expect(await run(SEED_IDS.assistant, { op: 'cancel', sessionId: id })).toEqual({ ok: false, error: 'not_found' });
    const earlier = new Date('2026-11-10T06:00:00Z');
    expect(await run(SEED_IDS.student, { op: 'cancel', sessionId: id }, NO_CALENDAR, earlier)).toMatchObject({ ok: true });
    expect((await repo.coachingSession(id))!.status).toBe('cancelled');
  });

  it('lets the moved session keep its own time when rescheduling around it', async () => {
    const booked = await bookWed();
    const id = booked.ok ? booked.id! : '';
    const early = new Date('2026-11-09T12:00:00Z');
    const r = await run(SEED_IDS.student, { op: 'reschedule', sessionId: id, startsAt: new Date('2026-11-11T08:30:00Z') }, NO_CALENDAR, early);
    expect(r).toMatchObject({ ok: true });
  });
});

describe('clientSession', () => {
  it('shows own and group sessions to grant holders, anything to staff', async () => {
    const booked = await bookWed();
    const id = booked.ok ? booked.id! : '';
    expect(await clientSession(repo, await as(SEED_IDS.student), id, NOW)).toMatchObject({ id });
    expect(await clientSession(repo, await as(SEED_IDS.assistant), id, NOW)).toMatchObject({ id });
    expect(await clientSession(repo, await as(null), id, NOW)).toBeNull();
  });
});

describe('myCoaching', () => {
  it('lists published coaching products the viewer holds a grant for', async () => {
    expect((await myCoaching(repo, await as(SEED_IDS.student), NOW)).map((p) => p.slug)).toEqual(['private-coaching']);
    expect(await myCoaching(repo, await as(SEED_IDS.assistant), NOW)).toEqual([]);
    expect(await myCoaching(repo, await as(null), NOW)).toEqual([]);
  });
});

describe('rescheduleSlots', () => {
  it('offers open slots including the own time for a changeable session, nothing otherwise', async () => {
    const booked = await run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: THU_9, agenda: '' });
    const id = booked.ok ? booked.id! : '';
    const early = new Date('2026-11-09T12:00:00Z');
    const mine = await rescheduleSlots(repo, await as(SEED_IDS.student), NO_CALENDAR, id, early);
    expect(mine.calendarDown).toBe(false);
    expect(mine.slots.map((d) => d.getTime())).toContain(THU_9.getTime());
    // Past the cutoff, and other people's sessions: no slots.
    expect((await rescheduleSlots(repo, await as(SEED_IDS.student), NO_CALENDAR, id, new Date('2026-11-12T00:00:00Z'))).slots).toEqual([]);
    expect((await rescheduleSlots(repo, await as(SEED_IDS.assistant), NO_CALENDAR, id, early)).slots).toEqual([]);
  });

  it('reports a calendar outage', async () => {
    const booked = await run(SEED_IDS.student, { op: 'book', productId: SEED_IDS.coaching, startsAt: THU_9, agenda: '' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down: CalendarPort = { ...NO_CALENDAR, busy: () => Promise.reject(new Error('google 503')) };
    const r = await rescheduleSlots(repo, await as(SEED_IDS.student), down, booked.ok ? booked.id! : '', new Date('2026-11-09T12:00:00Z'));
    expect(r).toEqual({ slots: [], calendarDown: true });
    spy.mockRestore();
  });
});

describe('sessionIcs', () => {
  it('gives the client a calendar file pointing at the session page, never for cancelled or hidden sessions', async () => {
    const booked = await bookWed();
    const id = booked.ok ? booked.id! : '';
    const ics = await sessionIcs(repo, await as(SEED_IDS.student), id, 'https://a.test/coaching/x/sessions/1', NOW);
    expect(ics).toContain('DTSTART:20261111T080000Z');
    expect(ics).toContain('LOCATION:https://a.test/coaching/x/sessions/1');
    expect(await sessionIcs(repo, await as(null), id, 'https://a.test/', NOW)).toBeNull();
    await repo.updateCoachingSession(id, { status: 'cancelled', cancelledAt: NOW });
    expect(await sessionIcs(repo, await as(SEED_IDS.student), id, 'https://a.test/', NOW)).toBeNull();
  });
});
