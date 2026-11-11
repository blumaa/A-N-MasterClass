// Coaching part of the fake repo: programs, coach settings, availability, sessions, notes and the
// Google Calendar connection. Same constraints as supabase/migrations/*_coaching.sql.
import { isTimeZone } from '@/lib/format/zoned';
import { ConstraintError, SESSION_OVERLAP } from '../errors';
import { grantIsActive } from '../grants';
import type { Repo } from '../repo';
import type { CoachingSession } from '../types';
import type { Db } from './db';

type CoachingRepo = Pick<
  Repo,
  | 'coachingProgram'
  | 'saveCoachingProgram'
  | 'coachSettings'
  | 'saveCoachSettings'
  | 'availabilityRules'
  | 'createAvailabilityRule'
  | 'deleteAvailabilityRule'
  | 'availabilityOverrides'
  | 'createAvailabilityOverride'
  | 'deleteAvailabilityOverride'
  | 'coachingSessions'
  | 'coachingSession'
  | 'createCoachingSession'
  | 'bookCoachingSession'
  | 'updateCoachingSession'
  | 'sessionNote'
  | 'saveSessionNote'
  | 'calendarConnection'
  | 'calendarRefreshToken'
  | 'saveCalendarConnection'
  | 'deleteCalendarConnection'
>;

export const NOTE_MAX = 20_000;
export const AGENDA_MAX = 2_000;
const HTTPS = /^https:\/\/\S+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MINUTES = 1440;

function check(ok: boolean, message: string): void {
  if (!ok) throw new ConstraintError(message);
}

const validWindow = (start: number, end: number) =>
  Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start < end && end <= DAY_MINUTES;

export function createFakeCoachingRepo(db: Db, id: (prefix: string) => string): CoachingRepo {
  /** Row checks plus the exclusion constraint over scheduled sessions of the space. */
  function checkSession(row: CoachingSession): void {
    const product = db.products.find((p) => p.id === row.productId);
    check(product?.kind === 'coaching' && product.spaceId === row.spaceId, 'product must be a coaching product of the space');
    check(row.title.trim().length > 0, 'title required');
    check(row.endsAt > row.startsAt, 'end must be after start');
    check(row.location === null || HTTPS.test(row.location), 'location must be an https link');
    check(row.agenda.length <= AGENDA_MAX, 'agenda too long');
    if (row.status !== 'scheduled') return;
    const clash = db.coachingSessions.some(
      (s) => s.id !== row.id && s.spaceId === row.spaceId && s.status === 'scheduled' && s.startsAt < row.endsAt && row.startsAt < s.endsAt,
    );
    check(!clash, SESSION_OVERLAP);
  }

  function insert(row: CoachingSession): CoachingSession {
    checkSession(row);
    db.coachingSessions.push(row);
    return row;
  }

  const newRow = (input: Parameters<Repo['createCoachingSession']>[0]): CoachingSession => ({
    ...input,
    id: id('session'),
    status: 'scheduled',
    googleEventId: null,
    cancelledAt: null,
  });

  return {
    coachingProgram: async (productId) => db.coachingPrograms.find((p) => p.productId === productId) ?? null,
    async saveCoachingProgram(row) {
      check(db.products.find((p) => p.id === row.productId)?.kind === 'coaching', 'product must be coaching');
      check(Number.isInteger(row.sessionMinutes) && row.sessionMinutes >= 15 && row.sessionMinutes <= 360, 'session length 15..360');
      check(Number.isInteger(row.sessionsIncluded) && row.sessionsIncluded >= 1, 'at least one session');
      check(row.location === null || HTTPS.test(row.location), 'location must be an https link');
      db.coachingPrograms = [...db.coachingPrograms.filter((p) => p.productId !== row.productId), { ...row }];
    },

    coachSettings: async (spaceId) => db.coachSettings.find((s) => s.spaceId === spaceId) ?? null,
    async saveCoachSettings(row) {
      check(isTimeZone(row.timeZone), 'unknown time zone');
      check([row.bufferBeforeMin, row.bufferAfterMin, row.minNoticeMin, row.cancelCutoffHours].every((n) => Number.isInteger(n) && n >= 0), 'must not be negative');
      check(Number.isInteger(row.windowDays) && row.windowDays >= 1 && row.windowDays <= 200, 'window 1..200 days');
      db.coachSettings = [...db.coachSettings.filter((s) => s.spaceId !== row.spaceId), { ...row }];
    },

    availabilityRules: async (spaceId) =>
      db.availabilityRules
        .filter((r) => r.spaceId === spaceId)
        .toSorted((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
    async createAvailabilityRule(input) {
      check(Number.isInteger(input.weekday) && input.weekday >= 0 && input.weekday <= 6, 'weekday 0..6');
      check(validWindow(input.startMinute, input.endMinute), 'window must be inside the day, start before end');
      const row = { ...input, id: id('avail') };
      db.availabilityRules.push(row);
      return row;
    },
    async deleteAvailabilityRule(rid) {
      db.availabilityRules = db.availabilityRules.filter((r) => r.id !== rid);
    },

    availabilityOverrides: async (spaceId) =>
      db.availabilityOverrides
        .filter((o) => o.spaceId === spaceId)
        .toSorted((a, b) => a.date.localeCompare(b.date) || (a.startMinute ?? -1) - (b.startMinute ?? -1)),
    async createAvailabilityOverride(input) {
      check(DATE.test(input.date) && !Number.isNaN(Date.parse(input.date)), 'date must be YYYY-MM-DD');
      const dayOff = input.startMinute === null && input.endMinute === null;
      check(dayOff || (input.startMinute !== null && input.endMinute !== null && validWindow(input.startMinute, input.endMinute)), 'day off or a valid window');
      const row = { ...input, id: id('override') };
      db.availabilityOverrides.push(row);
      return row;
    },
    async deleteAvailabilityOverride(oid) {
      db.availabilityOverrides = db.availabilityOverrides.filter((o) => o.id !== oid);
    },

    coachingSessions: async (where) =>
      db.coachingSessions
        .filter(
          (s) =>
            s.spaceId === where.spaceId &&
            (where.productId === undefined || s.productId === where.productId) &&
            (where.clientId === undefined || s.clientId === where.clientId),
        )
        .toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    coachingSession: async (sid) => db.coachingSessions.find((s) => s.id === sid) ?? null,
    createCoachingSession: async (input) => insert(newRow(input)),
    async bookCoachingSession(input) {
      const program = db.coachingPrograms.find((p) => p.productId === input.productId);
      check(program?.kind === 'one_on_one', 'only 1:1 programs take bookings');
      const held = db.grants.some(
        (g) => g.productId === input.productId && g.profileId === input.clientId && grantIsActive(g, input.createdAt),
      );
      check(held, 'client has no active grant');
      const used = db.coachingSessions.filter(
        (s) => s.productId === input.productId && s.clientId === input.clientId && s.status === 'scheduled',
      ).length;
      check(used < program!.sessionsIncluded, 'no sessions left');
      return insert(newRow(input));
    },
    async updateCoachingSession(sid, patch) {
      const current = db.coachingSessions.find((s) => s.id === sid);
      if (!current) throw new Error('session not found');
      const next = { ...current, ...patch };
      checkSession(next);
      Object.assign(current, patch);
      return current;
    },

    sessionNote: async (sessionId) => db.sessionNotes.find((n) => n.sessionId === sessionId) ?? null,
    async saveSessionNote(row) {
      check(db.coachingSessions.some((s) => s.id === row.sessionId), 'session not found');
      check(row.body.length <= NOTE_MAX, 'note too long');
      db.sessionNotes = [...db.sessionNotes.filter((n) => n.sessionId !== row.sessionId), { ...row }];
    },

    calendarConnection: async (spaceId) => db.calendarConnections.find((c) => c.spaceId === spaceId) ?? null,
    calendarRefreshToken: async (spaceId) => db.calendarSecrets.find((c) => c.spaceId === spaceId)?.refreshToken ?? null,
    async saveCalendarConnection(row, refreshToken) {
      db.calendarConnections = [...db.calendarConnections.filter((c) => c.spaceId !== row.spaceId), { ...row }];
      db.calendarSecrets = [...db.calendarSecrets.filter((c) => c.spaceId !== row.spaceId), { spaceId: row.spaceId, refreshToken }];
    },
    async deleteCalendarConnection(spaceId) {
      db.calendarConnections = db.calendarConnections.filter((c) => c.spaceId !== spaceId);
      db.calendarSecrets = db.calendarSecrets.filter((c) => c.spaceId !== spaceId);
    },
  };
}
