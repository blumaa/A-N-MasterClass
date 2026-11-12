import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError } from '../errors';
import type { NewCoachingSession } from '../repo';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-10T12:00:00Z');
const HOUR = 3_600_000;
const at = (h: number) => new Date(NOW.getTime() + h * HOUR);
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const session = (extra: Partial<NewCoachingSession> = {}): NewCoachingSession => ({
  productId: SEED_IDS.coaching,
  spaceId: SEED_IDS.alexander,
  clientId: SEED_IDS.student,
  title: 'Private Coaching',
  startsAt: at(24),
  endsAt: at(25),
  agenda: '',
  location: null,
  createdAt: NOW,
  ...extra,
});
const book = (extra: Partial<NewCoachingSession> = {}) =>
  repo.bookCoachingSession({ ...session(extra), clientId: extra.clientId ?? SEED_IDS.student });

describe('coaching programs', () => {
  it('reads the seeded program and upserts', async () => {
    const p = await repo.coachingProgram(SEED_IDS.coaching);
    expect(p).toMatchObject({ kind: 'one_on_one', sessionMinutes: 60, sessionsIncluded: 3 });
    await repo.saveCoachingProgram({ ...p!, sessionMinutes: 45 });
    expect((await repo.coachingProgram(SEED_IDS.coaching))!.sessionMinutes).toBe(45);
    expect(repo.db.coachingPrograms).toHaveLength(1);
  });

  it('refuses a non-coaching product, odd lengths and non-https links', async () => {
    const base = (await repo.coachingProgram(SEED_IDS.coaching))!;
    await expect(repo.saveCoachingProgram({ ...base, productId: SEED_IDS.program })).rejects.toThrow(ConstraintError);
    await expect(repo.saveCoachingProgram({ ...base, sessionMinutes: 10 })).rejects.toThrow(ConstraintError);
    await expect(repo.saveCoachingProgram({ ...base, sessionMinutes: 361 })).rejects.toThrow(ConstraintError);
    await expect(repo.saveCoachingProgram({ ...base, sessionsIncluded: 0 })).rejects.toThrow(ConstraintError);
    await expect(repo.saveCoachingProgram({ ...base, location: 'http://x' })).rejects.toThrow(ConstraintError);
  });
});

describe('coach settings and availability', () => {
  it('upserts settings with checks', async () => {
    const s = (await repo.coachSettings(SEED_IDS.alexander))!;
    await repo.saveCoachSettings({ ...s, windowDays: 30 });
    expect((await repo.coachSettings(SEED_IDS.alexander))!.windowDays).toBe(30);
    await expect(repo.saveCoachSettings({ ...s, timeZone: 'Mars/Base' })).rejects.toThrow(ConstraintError);
    await expect(repo.saveCoachSettings({ ...s, windowDays: 0 })).rejects.toThrow(ConstraintError);
    await expect(repo.saveCoachSettings({ ...s, bufferAfterMin: -1 })).rejects.toThrow(ConstraintError);
  });

  it('adds and removes weekly rules', async () => {
    const rule = await repo.createAvailabilityRule({ spaceId: SEED_IDS.alexander, weekday: 6, startMinute: 600, endMinute: 720 });
    expect(await repo.availabilityRules(SEED_IDS.alexander)).toContainEqual(rule);
    await repo.deleteAvailabilityRule(rule.id);
    expect((await repo.availabilityRules(SEED_IDS.alexander)).map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5]);
    await expect(
      repo.createAvailabilityRule({ spaceId: SEED_IDS.alexander, weekday: 7, startMinute: 0, endMinute: 60 }),
    ).rejects.toThrow(ConstraintError);
    await expect(
      repo.createAvailabilityRule({ spaceId: SEED_IDS.alexander, weekday: 1, startMinute: 600, endMinute: 600 }),
    ).rejects.toThrow(ConstraintError);
  });

  it('adds day-off and custom-hours overrides', async () => {
    const off = await repo.createAvailabilityOverride({ spaceId: SEED_IDS.alexander, date: '2026-12-24', startMinute: null, endMinute: null });
    expect(await repo.availabilityOverrides(SEED_IDS.alexander)).toEqual([off]);
    await expect(
      repo.createAvailabilityOverride({ spaceId: SEED_IDS.alexander, date: '24.12.2026', startMinute: null, endMinute: null }),
    ).rejects.toThrow(ConstraintError);
    await expect(
      repo.createAvailabilityOverride({ spaceId: SEED_IDS.alexander, date: '2026-12-25', startMinute: 600, endMinute: null }),
    ).rejects.toThrow(ConstraintError);
    await repo.deleteAvailabilityOverride(off.id);
    expect(await repo.availabilityOverrides(SEED_IDS.alexander)).toEqual([]);
  });
});

describe('sessions', () => {
  it('creates group sessions and lists them soonest first', async () => {
    const later = await repo.createCoachingSession(session({ clientId: null, startsAt: at(48), endsAt: at(49) }));
    const sooner = await repo.createCoachingSession(session({ clientId: null }));
    expect(later.status).toBe('scheduled');
    const rows = await repo.coachingSessions({ spaceId: SEED_IDS.alexander });
    expect(rows.map((s) => s.id)).toEqual([sooner.id, later.id]);
    expect(await repo.coachingSessions({ spaceId: SEED_IDS.alexander, clientId: SEED_IDS.student })).toEqual([]);
  });

  it('refuses overlap with a scheduled session of the space, not with a cancelled one', async () => {
    const first = await repo.createCoachingSession(session());
    await expect(repo.createCoachingSession(session({ startsAt: at(24.5), endsAt: at(25.5) }))).rejects.toThrow(ConstraintError);
    await repo.createCoachingSession(session({ startsAt: at(25), endsAt: at(26) })); // touching is fine
    await repo.updateCoachingSession(first.id, { status: 'cancelled', cancelledAt: NOW });
    await repo.createCoachingSession(session({ startsAt: at(24), endsAt: at(25) }));
  });

  it('refuses a bad window, link or product', async () => {
    await expect(repo.createCoachingSession(session({ endsAt: at(24) }))).rejects.toThrow(ConstraintError);
    await expect(repo.createCoachingSession(session({ location: 'zoom' }))).rejects.toThrow(ConstraintError);
    await expect(repo.createCoachingSession(session({ productId: SEED_IDS.program }))).rejects.toThrow(ConstraintError);
    await expect(repo.createCoachingSession(session({ spaceId: SEED_IDS.natasha }))).rejects.toThrow(ConstraintError);
  });

  it('reschedules with the overlap check, ignoring itself', async () => {
    const a = await repo.createCoachingSession(session());
    await repo.createCoachingSession(session({ startsAt: at(30), endsAt: at(31) }));
    const moved = await repo.updateCoachingSession(a.id, { startsAt: at(24.5), endsAt: at(25.5) });
    expect(moved.startsAt).toEqual(at(24.5));
    expect(a.startsAt).not.toEqual(at(24.5));
    await expect(repo.updateCoachingSession(a.id, { startsAt: at(30), endsAt: at(31) })).rejects.toThrow(ConstraintError);
  });
});

describe('bookCoachingSession', () => {
  it('books up to sessionsIncluded, cancelled ones do not count', async () => {
    const one = await book();
    await book({ startsAt: at(26), endsAt: at(27) });
    await book({ startsAt: at(28), endsAt: at(29) });
    await expect(book({ startsAt: at(30), endsAt: at(31) })).rejects.toThrow(ConstraintError);
    await repo.updateCoachingSession(one.id, { status: 'cancelled', cancelledAt: NOW });
    await book({ startsAt: at(30), endsAt: at(31) });
  });

  it('needs an active grant and a one_on_one program', async () => {
    await expect(book({ clientId: SEED_IDS.assistant })).rejects.toThrow(ConstraintError);
    repo.db.grants.find((g) => g.id === 'grant-student-coaching')!.expiresAt = at(-1);
    await expect(book()).rejects.toThrow(ConstraintError);
    repo.db.grants.find((g) => g.id === 'grant-student-coaching')!.expiresAt = null;
    repo.db.coachingPrograms[0]!.kind = 'group';
    await expect(book()).rejects.toThrow(ConstraintError);
  });
});

describe('notes and calendar connection', () => {
  it('upserts a note', async () => {
    const s = await repo.createCoachingSession(session());
    await repo.saveSessionNote({ sessionId: s.id, body: 'a', updatedAt: NOW });
    await repo.saveSessionNote({ sessionId: s.id, body: 'b', updatedAt: at(1) });
    expect(await repo.sessionNote(s.id)).toEqual({ sessionId: s.id, body: 'b', updatedAt: at(1) });
    await expect(repo.saveSessionNote({ sessionId: s.id, body: 'x'.repeat(20_001), updatedAt: NOW })).rejects.toThrow(ConstraintError);
  });

  it('keeps the token apart from the row and deletes both', async () => {
    const row = { spaceId: SEED_IDS.alexander, provider: 'google' as const, accountEmail: 'a@example.test', calendarId: 'primary', connectedAt: NOW };
    await repo.saveCalendarConnection(row, 'tok-1');
    await repo.saveCalendarConnection(row, 'tok-2');
    expect(await repo.calendarConnection(SEED_IDS.alexander)).toEqual(row);
    expect(await repo.calendarRefreshToken(SEED_IDS.alexander)).toBe('tok-2');
    await repo.deleteCalendarConnection(SEED_IDS.alexander);
    expect(await repo.calendarConnection(SEED_IDS.alexander)).toBeNull();
    expect(await repo.calendarRefreshToken(SEED_IDS.alexander)).toBeNull();
  });
});
