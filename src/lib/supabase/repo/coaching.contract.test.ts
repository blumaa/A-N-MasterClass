// Coaching Supabase repo against the linked project, as the service client (RLS is covered by the
// SQL suites). Booking runs as a real signed-in client because the RPC reads auth.uid().
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabasePublic } from '@/config/supabase';
import { ConstraintError } from '@/lib/data/errors';
import type { NewCoachingSession } from '@/lib/data/repo';
import type { CoachingProgram, CoachSettings } from '@/lib/data/types';
import type { Database } from '@/lib/db/database.types';
import { createCoachingRepo, type CoachingRepo } from './coaching';
import { createCoreRepo, type CoreRepo } from './core';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const inDays = (n: number, hour = 10) => new Date(Math.floor(Date.now() / DAY) * DAY + n * DAY + hour * HOUR);

describe.skipIf(!contractEnabled)('coaching repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let repo: CoachingRepo;
  let core: CoreRepo;
  let spaceId: string;
  let n = 0;

  async function coachingProduct(publish = false) {
    n += 1;
    const p = await core.createProduct({ spaceId, kind: 'coaching', slug: `c${n}`, title: `Coaching ${n}` });
    if (publish) await core.updateProduct(p.id, { status: 'published' });
    return p;
  }

  const session = (productId: string, startsAt: Date, over: Partial<NewCoachingSession> = {}): NewCoachingSession => ({
    productId,
    spaceId,
    clientId: null,
    title: 'Session',
    startsAt,
    endsAt: new Date(startsAt.getTime() + HOUR),
    agenda: '',
    location: null,
    createdAt: new Date(),
    ...over,
  });

  beforeAll(async () => {
    fx = await createContractSpace('coaching');
    spaceId = fx.spaceId;
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    repo = createCoachingRepo(ctx);
    core = createCoreRepo(ctx);
  });
  afterAll(async () => {
    await fx?.cleanup();
  });

  describe('program', () => {
    it('is null until saved, then upserts', async () => {
      const p = await coachingProduct();
      expect(await repo.coachingProgram(p.id)).toBeNull();
      const row: CoachingProgram = { productId: p.id, kind: 'one_on_one', sessionMinutes: 45, sessionsIncluded: 3, location: 'https://meet.example/a' };
      await repo.saveCoachingProgram(row);
      expect(await repo.coachingProgram(p.id)).toEqual(row);
      await repo.saveCoachingProgram({ ...row, kind: 'group', location: null });
      expect(await repo.coachingProgram(p.id)).toEqual({ ...row, kind: 'group', location: null });
    });

    it('refuses bad minutes, sessions, location and non-coaching products', async () => {
      const p = await coachingProduct();
      const ok: CoachingProgram = { productId: p.id, kind: 'group', sessionMinutes: 60, sessionsIncluded: 1, location: null };
      await expect(repo.saveCoachingProgram({ ...ok, sessionMinutes: 14 })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachingProgram({ ...ok, sessionMinutes: 361 })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachingProgram({ ...ok, sessionsIncluded: 0 })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachingProgram({ ...ok, location: 'http://x.example' })).rejects.toBeInstanceOf(ConstraintError);
      const course = await core.createProduct({ spaceId, kind: 'program', slug: 'not-coaching', title: 'P' });
      await expect(repo.saveCoachingProgram({ ...ok, productId: course.id })).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  describe('coach settings', () => {
    const base: CoachSettings = {
      spaceId: '',
      timeZone: 'Europe/Lisbon',
      bufferBeforeMin: 5,
      bufferAfterMin: 10,
      minNoticeMin: 60,
      windowDays: 30,
      cancelCutoffHours: 12,
    };

    it('is null until saved, then upserts', async () => {
      const space = { ...base, spaceId };
      expect(await repo.coachSettings(spaceId)).toBeNull();
      await repo.saveCoachSettings(space);
      expect(await repo.coachSettings(spaceId)).toEqual(space);
      await repo.saveCoachSettings({ ...space, windowDays: 60 });
      expect((await repo.coachSettings(spaceId))?.windowDays).toBe(60);
    });

    it('refuses unknown zone, negatives and window outside 1..200', async () => {
      const s = { ...base, spaceId };
      await expect(repo.saveCoachSettings({ ...s, timeZone: 'Mars/Base' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachSettings({ ...s, bufferBeforeMin: -1 })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachSettings({ ...s, minNoticeMin: -1 })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachSettings({ ...s, cancelCutoffHours: -1 })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachSettings({ ...s, windowDays: 0 })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.saveCoachSettings({ ...s, windowDays: 201 })).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  describe('availability', () => {
    it('lists rules by weekday then start, and deletes (unknown id is a no-op)', async () => {
      const mk = (weekday: number, startMinute: number, endMinute: number) =>
        repo.createAvailabilityRule({ spaceId, weekday, startMinute, endMinute });
      const c = await mk(3, 600, 700);
      const a = await mk(1, 900, 1000);
      const b = await mk(1, 480, 600);
      expect((await repo.availabilityRules(spaceId)).map((r) => r.id)).toEqual([b.id, a.id, c.id]);
      await repo.deleteAvailabilityRule(a.id);
      await repo.deleteAvailabilityRule(a.id);
      expect((await repo.availabilityRules(spaceId)).map((r) => r.id)).toEqual([b.id, c.id]);
    });

    it('refuses bad weekday and windows', async () => {
      const bad = (weekday: number, startMinute: number, endMinute: number) =>
        expect(repo.createAvailabilityRule({ spaceId, weekday, startMinute, endMinute })).rejects.toBeInstanceOf(ConstraintError);
      await bad(7, 0, 60);
      await bad(-1, 0, 60);
      await bad(1, 60, 60);
      await bad(1, -1, 60);
      await bad(1, 0, 1441);
    });

    it('lists overrides by date, day off first within a date', async () => {
      const mk = (date: string, startMinute: number | null, endMinute: number | null) =>
        repo.createAvailabilityOverride({ spaceId, date, startMinute, endMinute });
      const late = await mk('2031-02-02', 600, 700);
      const off = await mk('2031-02-02', null, null);
      const early = await mk('2031-01-01', 0, 60);
      const ids = (await repo.availabilityOverrides(spaceId)).map((o) => o.id);
      expect(ids).toEqual([early.id, off.id, late.id]);
      expect(off).toMatchObject({ date: '2031-02-02', startMinute: null, endMinute: null });
      await repo.deleteAvailabilityOverride(off.id);
      expect((await repo.availabilityOverrides(spaceId)).map((o) => o.id)).toEqual([early.id, late.id]);
    });

    it('refuses half-set, inverted and out-of-day overrides', async () => {
      const bad = (startMinute: number | null, endMinute: number | null) =>
        expect(repo.createAvailabilityOverride({ spaceId, date: '2031-03-03', startMinute, endMinute })).rejects.toBeInstanceOf(ConstraintError);
      await bad(60, null);
      await bad(null, 60);
      await bad(60, 60);
      await bad(0, 1441);
    });
  });

  describe('sessions', () => {
    it('creates scheduled sessions and lists them soonest first, filtered', async () => {
      const p = await coachingProduct();
      const q = await coachingProduct();
      const client = await fx.newUser('lister');
      const late = await repo.createCoachingSession(session(p.id, inDays(40, 15), { clientId: client, agenda: 'a' }));
      const early = await repo.createCoachingSession(session(p.id, inDays(40, 9)));
      const other = await repo.createCoachingSession(session(q.id, inDays(41, 9), { location: 'https://x.example/j' }));
      expect(late).toMatchObject({ status: 'scheduled', googleEventId: null, cancelledAt: null, clientId: client, agenda: 'a' });
      expect(other.location).toBe('https://x.example/j');
      const all = (await repo.coachingSessions({ spaceId })).map((s) => s.id);
      expect(all).toEqual([early.id, late.id, other.id]);
      expect((await repo.coachingSessions({ spaceId, productId: p.id })).map((s) => s.id)).toEqual([early.id, late.id]);
      expect((await repo.coachingSessions({ spaceId, clientId: client })).map((s) => s.id)).toEqual([late.id]);
      expect(await repo.coachingSession(early.id)).toEqual(early);
      expect(await repo.coachingSession('00000000-0000-4000-8000-000000000000')).toBeNull();
    });

    it('refuses bad range, location, title, agenda and foreign products', async () => {
      const p = await coachingProduct();
      const at = inDays(50);
      const bad = (over: Partial<NewCoachingSession>) =>
        expect(repo.createCoachingSession(session(p.id, at, over))).rejects.toBeInstanceOf(ConstraintError);
      await bad({ endsAt: at });
      await bad({ endsAt: new Date(at.getTime() - HOUR) });
      await bad({ location: 'http://x.example' });
      await bad({ title: '   ' });
      await bad({ agenda: 'x'.repeat(2001) });
      const course = await core.createProduct({ spaceId, kind: 'program', slug: 'not-coaching-2', title: 'P' });
      await expect(repo.createCoachingSession(session(course.id, at))).rejects.toBeInstanceOf(ConstraintError);
    });

    it('refuses an overlapping scheduled session; touching and cancelled ones are fine', async () => {
      const p = await coachingProduct();
      const at = inDays(60);
      const first = await repo.createCoachingSession(session(p.id, at));
      await expect(repo.createCoachingSession(session(p.id, new Date(at.getTime() + HOUR / 2)))).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createCoachingSession(session(p.id, at))).rejects.toBeInstanceOf(ConstraintError);
      await repo.createCoachingSession(session(p.id, new Date(at.getTime() + HOUR)));
      const cancelledAt = new Date();
      await repo.updateCoachingSession(first.id, { status: 'cancelled', cancelledAt });
      await repo.createCoachingSession(session(p.id, at));
    });

    it('updates only the named fields, and checks overlap when it stays scheduled', async () => {
      const p = await coachingProduct();
      const at = inDays(70);
      const a = await repo.createCoachingSession(session(p.id, at, { agenda: 'keep' }));
      const b = await repo.createCoachingSession(session(p.id, new Date(at.getTime() + 2 * HOUR)));
      const updated = await repo.updateCoachingSession(a.id, { title: 'New', googleEventId: 'evt1', location: 'https://z.example' });
      expect(updated).toMatchObject({ title: 'New', googleEventId: 'evt1', location: 'https://z.example', agenda: 'keep' });
      const cleared = await repo.updateCoachingSession(a.id, { location: null });
      expect(cleared.location).toBeNull();
      await expect(
        repo.updateCoachingSession(b.id, { startsAt: new Date(at.getTime() + HOUR / 2), endsAt: new Date(at.getTime() + 2 * HOUR) }),
      ).rejects.toBeInstanceOf(ConstraintError);
      const cancelled = await repo.updateCoachingSession(a.id, { status: 'cancelled', cancelledAt: new Date() });
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      await expect(repo.updateCoachingSession(a.id, { status: 'cancelled', cancelledAt: null })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.updateCoachingSession('00000000-0000-4000-8000-000000000000', { title: 'x' })).rejects.toThrow();
    });
  });

  describe('booking (RPC, as a signed-in client)', () => {
    async function signedIn(name: string) {
      const id = await fx.newUser(name);
      const password = `pw-${Date.now().toString(36)}-${name}`;
      const set = await fx.admin.auth.admin.updateUserById(id, { password });
      if (set.error) throw set.error;
      const { url, publishableKey } = supabasePublic();
      const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const email = fx.email(name);
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      return { id, repo: createCoachingRepo({ db: async () => client, admin: () => fx.admin }) };
    }

    async function bookable(sessionsIncluded: number, kind: CoachingProgram['kind'] = 'one_on_one') {
      const p = await coachingProduct(true);
      await repo.saveCoachingProgram({ productId: p.id, kind, sessionMinutes: 60, sessionsIncluded, location: 'https://meet.example/p' });
      return p;
    }

    it('books for the caller with product title, program location and trimmed agenda', async () => {
      const p = await bookable(2);
      const client = await signedIn('booker');
      await core.createGrant({ productId: p.id, profileId: client.id, source: 'manual' });
      const at = inDays(80);
      const booked = await client.repo.bookCoachingSession({ ...session(p.id, at, { agenda: '  topic  ' }), clientId: client.id });
      expect(booked).toMatchObject({
        productId: p.id,
        spaceId,
        clientId: client.id,
        title: p.title,
        status: 'scheduled',
        agenda: 'topic',
        location: 'https://meet.example/p',
      });
      expect(booked.startsAt).toEqual(at);
    });

    it('refuses double booking, no sessions left, wrong length, no grant and group programs', async () => {
      const p = await bookable(1);
      const a = await signedIn('a');
      const b = await signedIn('b');
      await core.createGrant({ productId: p.id, profileId: a.id, source: 'manual' });
      await core.createGrant({ productId: p.id, profileId: b.id, source: 'manual' });
      const at = inDays(90);
      await a.repo.bookCoachingSession({ ...session(p.id, at), clientId: a.id });
      // same slot, other client: exclusion constraint
      await expect(b.repo.bookCoachingSession({ ...session(p.id, at), clientId: b.id })).rejects.toBeInstanceOf(ConstraintError);
      // balance used up
      await expect(a.repo.bookCoachingSession({ ...session(p.id, inDays(91)), clientId: a.id })).rejects.toBeInstanceOf(ConstraintError);
      // wrong length
      await expect(
        b.repo.bookCoachingSession({ ...session(p.id, inDays(92), { endsAt: new Date(inDays(92).getTime() + 2 * HOUR) }), clientId: b.id }),
      ).rejects.toBeInstanceOf(ConstraintError);

      const noGrant = await signedIn('nogrant');
      await expect(noGrant.repo.bookCoachingSession({ ...session(p.id, inDays(93)), clientId: noGrant.id })).rejects.toThrow();

      const group = await bookable(1, 'group');
      await core.createGrant({ productId: group.id, profileId: b.id, source: 'manual' });
      await expect(b.repo.bookCoachingSession({ ...session(group.id, inDays(94)), clientId: b.id })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('does not count cancelled sessions against the balance', async () => {
      const p = await bookable(1);
      const c = await signedIn('cancel');
      await core.createGrant({ productId: p.id, profileId: c.id, source: 'manual' });
      const first = await c.repo.bookCoachingSession({ ...session(p.id, inDays(100)), clientId: c.id });
      await repo.updateCoachingSession(first.id, { status: 'cancelled', cancelledAt: new Date() });
      await c.repo.bookCoachingSession({ ...session(p.id, inDays(101)), clientId: c.id });
    });
  });

  describe('session notes', () => {
    it('upserts per session, refuses long bodies and unknown sessions', async () => {
      const p = await coachingProduct();
      const s = await repo.createCoachingSession(session(p.id, inDays(110)));
      expect(await repo.sessionNote(s.id)).toBeNull();
      const updatedAt = new Date('2031-01-01T00:00:00.000Z');
      await repo.saveSessionNote({ sessionId: s.id, body: 'one', updatedAt });
      expect(await repo.sessionNote(s.id)).toEqual({ sessionId: s.id, body: 'one', updatedAt });
      await repo.saveSessionNote({ sessionId: s.id, body: 'two', updatedAt });
      expect((await repo.sessionNote(s.id))?.body).toBe('two');
      await expect(repo.saveSessionNote({ sessionId: s.id, body: 'x'.repeat(20_001), updatedAt })).rejects.toBeInstanceOf(ConstraintError);
      await expect(
        repo.saveSessionNote({ sessionId: '00000000-0000-4000-8000-000000000000', body: 'x', updatedAt }),
      ).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  describe('calendar connection', () => {
    it('stores row + token, hides the token from the row, replaces and deletes', async () => {
      expect(await repo.calendarConnection(spaceId)).toBeNull();
      expect(await repo.calendarRefreshToken(spaceId)).toBeNull();
      const row = { spaceId, provider: 'google' as const, accountEmail: 'coach@example.com', calendarId: 'primary', connectedAt: new Date() };
      await repo.saveCalendarConnection(row, 'refresh-1');
      const saved = await repo.calendarConnection(spaceId);
      expect(saved).toMatchObject({ spaceId, provider: 'google', accountEmail: 'coach@example.com', calendarId: 'primary' });
      expect(JSON.stringify(saved)).not.toContain('refresh-1');
      expect(Object.keys(saved!)).not.toContain('tokenId');
      expect(await repo.calendarRefreshToken(spaceId)).toBe('refresh-1');
      await repo.saveCalendarConnection({ ...row, calendarId: 'work' }, 'refresh-2');
      expect((await repo.calendarConnection(spaceId))?.calendarId).toBe('work');
      expect(await repo.calendarRefreshToken(spaceId)).toBe('refresh-2');
      await repo.deleteCalendarConnection(spaceId);
      await repo.deleteCalendarConnection(spaceId);
      expect(await repo.calendarConnection(spaceId)).toBeNull();
      expect(await repo.calendarRefreshToken(spaceId)).toBeNull();
    });

    it('refuses a malformed email', async () => {
      const row = { spaceId, provider: 'google' as const, accountEmail: 'nope', calendarId: 'primary', connectedAt: new Date() };
      await expect(repo.saveCalendarConnection(row, 't')).rejects.toBeInstanceOf(ConstraintError);
    });
  });
});
