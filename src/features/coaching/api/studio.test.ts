import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { editBooking } from './booking';
import { NO_CALENDAR, type CalendarPort } from './schedule';
import { DEFAULT_PROGRAM, editCoaching, studioCoaching, studioSession, type CoachingCommand } from './studio';

const NOW = new Date('2026-11-10T12:00:00Z');
const WED_9 = new Date('2026-11-11T08:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (who: string | null, space = 'alexander') => (await resolveViewer(repo, space, who))!;
const run = async (who: string | null, c: CoachingCommand, calendar: CalendarPort = NO_CALENDAR, space = 'alexander') =>
  editCoaching(repo, await as(who, space), calendar, c, NOW);
const idOf = (r: Awaited<ReturnType<typeof run>>) => (r.ok ? r.id! : '');
const bookWed = async () =>
  idOf(await editBooking(repo, await as(SEED_IDS.student), NO_CALENDAR, { op: 'book', productId: SEED_IDS.coaching, startsAt: WED_9, agenda: 'knots' }, NOW));
const groupProduct = async () => {
  const id = idOf(await run(SEED_IDS.alexanderOwner, { op: 'createProgram', title: 'Group Lab', slug: 'group-lab' }));
  await run(SEED_IDS.alexanderOwner, { op: 'saveProgram', productId: id, ...DEFAULT_PROGRAM, kind: 'group', location: 'https://meet.example.test/lab' });
  return id;
};

describe('studioCoaching', () => {
  it('lists coaching products, schedule and upcoming sessions with client names and sync state', async () => {
    await bookWed();
    await repo.saveCalendarConnection(
      { spaceId: SEED_IDS.alexander, provider: 'google', accountEmail: 'a@example.test', calendarId: 'primary', connectedAt: NOW },
      'refresh',
    );
    const s = (await studioCoaching(repo, await as(SEED_IDS.alexanderOwner), NOW))!;
    expect(s.products.map((p) => p.product.slug)).toEqual(['private-coaching']);
    expect(s).toMatchObject({ defaultHours: false, canManageCalendar: true, settings: { timeZone: 'Europe/Berlin' } });
    expect(s.rules).toHaveLength(5);
    expect(s.upcoming).toEqual([expect.objectContaining({ clientName: 'Robin (student)', outOfSync: true })]);
  });

  it('shows default hours for a coach who saved nothing, and hides calendar settings from assistants', async () => {
    expect((await studioCoaching(repo, await as(SEED_IDS.natashaOwner, 'natasha'), NOW))!.defaultHours).toBe(true);
    expect((await studioCoaching(repo, await as(SEED_IDS.assistant), NOW))!.canManageCalendar).toBe(false);
    expect(await studioCoaching(repo, await as(SEED_IDS.student), NOW)).toBeNull();
  });
});

describe('studioSession', () => {
  it('shows the session with its private note to staff of the space only', async () => {
    const id = await bookWed();
    await run(SEED_IDS.assistant, { op: 'saveNote', sessionId: id, body: 'Work on the hip harness.' });
    expect(await studioSession(repo, await as(SEED_IDS.alexanderOwner), id)).toMatchObject({
      note: 'Work on the hip harness.',
      session: { agenda: 'knots', clientName: 'Robin (student)' },
    });
    expect(await studioSession(repo, await as(SEED_IDS.student), id)).toBeNull();
    expect(await studioSession(repo, await as(SEED_IDS.natashaOwner, 'natasha'), id)).toBeNull();
  });
});

describe('editCoaching', () => {
  it('creates a coaching product with the default program', async () => {
    const id = idOf(await run(SEED_IDS.assistant, { op: 'createProgram', title: 'Mentoring', slug: 'mentoring' }));
    expect(await repo.product(id)).toMatchObject({ kind: 'coaching', status: 'draft' });
    expect(await repo.coachingProgram(id)).toEqual({ productId: id, ...DEFAULT_PROGRAM });
  });

  it('renames and publishes a coaching product, never another kind', async () => {
    const patch = { title: 'Mentoring', subtitle: null, status: 'published' as const };
    expect(await run(SEED_IDS.assistant, { op: 'updateProduct', productId: SEED_IDS.coaching, patch })).toMatchObject({ ok: true });
    expect(await repo.product(SEED_IDS.coaching)).toMatchObject(patch);
    const program = repo.db.products.find((p) => p.kind === 'program')!;
    expect(await run(SEED_IDS.assistant, { op: 'updateProduct', productId: program.id, patch })).toEqual({ ok: false, error: 'not_found' });
  });

  it('saves program and settings, refusing invalid values', async () => {
    expect(
      await run(SEED_IDS.alexanderOwner, { op: 'saveProgram', productId: SEED_IDS.coaching, ...DEFAULT_PROGRAM, sessionMinutes: 5 }),
    ).toMatchObject({ ok: false, error: 'invalid' });
    const settings = { timeZone: 'America/New_York', bufferBeforeMin: 5, bufferAfterMin: 5, minNoticeMin: 60, windowDays: 30, cancelCutoffHours: 12 };
    expect(await run(SEED_IDS.alexanderOwner, { op: 'saveSettings', ...settings })).toMatchObject({ ok: true });
    expect(await repo.coachSettings(SEED_IDS.alexander)).toEqual({ spaceId: SEED_IDS.alexander, ...settings });
    expect(await run(SEED_IDS.alexanderOwner, { op: 'saveSettings', ...settings, timeZone: 'Mars/Base' })).toMatchObject({ error: 'invalid' });
  });

  it('adds and deletes availability, never another space\'s rows', async () => {
    const rule = idOf(await run(SEED_IDS.alexanderOwner, { op: 'addRule', weekday: 6, startMinute: 600, endMinute: 720 }));
    const day = idOf(await run(SEED_IDS.alexanderOwner, { op: 'addOverride', date: '2026-12-24', startMinute: null, endMinute: null }));
    expect(await run(SEED_IDS.natashaOwner, { op: 'deleteRule', ruleId: rule }, NO_CALENDAR, 'natasha')).toEqual({ ok: false, error: 'not_found' });
    expect(await run(SEED_IDS.alexanderOwner, { op: 'deleteRule', ruleId: rule })).toMatchObject({ ok: true });
    expect(await run(SEED_IDS.alexanderOwner, { op: 'deleteOverride', overrideId: day })).toMatchObject({ ok: true });
    expect(await repo.availabilityOverrides(SEED_IDS.alexander)).toEqual([]);
    expect(await run(SEED_IDS.alexanderOwner, { op: 'addRule', weekday: 1, startMinute: 700, endMinute: 600 })).toMatchObject({ error: 'invalid' });
  });

  it('schedules group sessions only, mirrored to Google', async () => {
    const sync = vi.fn(async () => 'evt-g');
    expect(
      await run(SEED_IDS.alexanderOwner, { op: 'createSession', productId: SEED_IDS.coaching, title: 'Q&A', startsAt: WED_9, minutes: 60, agenda: '' }),
    ).toMatchObject({ error: 'invalid' });
    const product = await groupProduct();
    const id = idOf(
      await run(SEED_IDS.alexanderOwner, { op: 'createSession', productId: product, title: ' Lab 1 ', startsAt: WED_9, minutes: 90, agenda: '' }, { ...NO_CALENDAR, sync }),
    );
    expect(await repo.coachingSession(id)).toMatchObject({
      clientId: null,
      title: 'Lab 1',
      endsAt: new Date('2026-11-11T09:30:00Z'),
      location: 'https://meet.example.test/lab',
      googleEventId: 'evt-g',
    });
  });

  it('moves and cancels any session regardless of the client cutoff, but never onto another', async () => {
    const id = await bookWed();
    const product = await groupProduct();
    await run(SEED_IDS.alexanderOwner, { op: 'createSession', productId: product, title: 'Lab', startsAt: new Date('2026-11-11T10:00:00Z'), minutes: 60, agenda: '' });
    expect(await run(SEED_IDS.alexanderOwner, { op: 'reschedule', sessionId: id, startsAt: new Date('2026-11-11T10:30:00Z') })).toMatchObject({
      error: 'invalid',
    });
    expect(await run(SEED_IDS.alexanderOwner, { op: 'reschedule', sessionId: id, startsAt: new Date('2026-11-10T13:00:00Z') })).toMatchObject({ ok: true });
    expect((await repo.coachingSession(id))!.endsAt).toEqual(new Date('2026-11-10T14:00:00Z'));
    expect(await run(SEED_IDS.alexanderOwner, { op: 'cancel', sessionId: id })).toMatchObject({ ok: true });
    expect(await run(SEED_IDS.alexanderOwner, { op: 'reschedule', sessionId: id, startsAt: WED_9 })).toMatchObject({ error: 'invalid' });
  });

  it('retries a failed Google sync', async () => {
    const id = await bookWed();
    expect(await run(SEED_IDS.alexanderOwner, { op: 'syncAgain', sessionId: id }, { ...NO_CALENDAR, sync: async () => 'evt-2' })).toMatchObject({ ok: true });
    expect((await repo.coachingSession(id))!.googleEventId).toBe('evt-2');
  });

  it('is staff only', async () => {
    expect(await run(SEED_IDS.student, { op: 'createProgram', title: 'x', slug: 'x' })).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(null, { op: 'createProgram', title: 'x', slug: 'x' })).toEqual({ ok: false, error: 'forbidden' });
  });
});
