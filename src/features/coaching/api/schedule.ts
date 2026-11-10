// Coach schedule (G19): stored settings + availability as a slot-engine Schedule, and the busy
// time slots must avoid (scheduled sessions of the space + the coach's Google Calendar).
// The calendar is a port so the DAL stays testable; NO_CALENDAR = not connected.
import type { Repo } from '@/lib/data/repo';
import type { CoachingSession, CoachSettings } from '@/lib/data/types';
import { reportError } from '@/lib/errors/report';
import { availableSlots, DEFAULT_RULES, type Busy, type Schedule } from '@/lib/scheduling/slots';

const DAY_MS = 86_400_000;

/** External calendar of the space's coach. */
export type CalendarPort = {
  /** Busy intervals in [from, to). [] when the space has no connection. Throws when the calendar is unreachable. */
  busy(spaceId: string, from: Date, to: Date): Promise<Busy[]>;
  /** Mirrors a session: scheduled = create or move the event, cancelled = delete it. Returns the event id (null = none). */
  sync(session: CoachingSession): Promise<string | null>;
};

export const NO_CALENDAR: CalendarPort = {
  busy: async () => [],
  sync: async () => null,
};

/** Used until the coach saves settings. */
export const defaultCoachSettings = (spaceId: string): CoachSettings => ({
  spaceId,
  timeZone: 'UTC',
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeMin: 4 * 60,
  windowDays: 14,
  cancelCutoffHours: 24,
});

export async function coachSettingsOf(repo: Repo, spaceId: string): Promise<CoachSettings> {
  return (await repo.coachSettings(spaceId)) ?? defaultCoachSettings(spaceId);
}

/** Kajabi's default hours (weekdays 9 to 5) apply until the coach saves settings or adds a window. */
export const usesDefaultHours = (stored: CoachSettings | null, rules: readonly unknown[]): boolean =>
  stored === null && rules.length === 0;

export async function loadSchedule(repo: Repo, spaceId: string): Promise<Schedule> {
  const [stored, rules, overrides] = await Promise.all([
    repo.coachSettings(spaceId),
    repo.availabilityRules(spaceId),
    repo.availabilityOverrides(spaceId),
  ]);
  const settings = stored ?? defaultCoachSettings(spaceId);
  return { ...settings, rules: usesDefaultHours(stored, rules) ? DEFAULT_RULES : rules, overrides };
}

export type OpenSlots = { schedule: Schedule; slots: Date[] };

/**
 * Bookable starts for a session of `durationMin`. `except` = the session being rescheduled, so
 * its own time does not count as busy. Throws when the calendar is unreachable.
 */
export async function openSlots(
  repo: Repo,
  calendar: CalendarPort,
  spaceId: string,
  durationMin: number,
  now: Date,
  except: string | null = null,
): Promise<OpenSlots> {
  const schedule = await loadSchedule(repo, spaceId);
  const to = new Date(now.getTime() + (schedule.windowDays + 1) * DAY_MS);
  const [sessions, external] = await Promise.all([
    repo.coachingSessions({ spaceId }),
    calendar.busy(spaceId, now, to),
  ]);
  const scheduled = sessions.filter((s) => s.status === 'scheduled' && s.endsAt > now);
  const moving = scheduled.find((s) => s.id === except);
  const own = scheduled.filter((s) => s !== moving).map((s) => ({ start: s.startsAt, end: s.endsAt }));
  // Synced sessions show up in Google too (overlap blocks the same slots, so no dedupe), except
  // the one being moved: its Google copy must not block its own new time.
  const sameAs = (b: Busy, s: CoachingSession) => b.start.getTime() === s.startsAt.getTime() && b.end.getTime() === s.endsAt.getTime();
  const others = moving ? external.filter((b) => !sameAs(b, moving)) : external;
  return { schedule, slots: availableSlots(schedule, { durationMin, busy: [...own, ...others], now }) };
}

/**
 * Mirrors a session to the coach's calendar after the DB write. The DB row is the truth: when
 * Google fails the error is reported and the row keeps its old event id, which Studio shows as
 * "not synced" with a retry.
 */
export async function syncToCalendar(repo: Repo, calendar: CalendarPort, session: CoachingSession): Promise<void> {
  try {
    const eventId = await calendar.sync(session);
    if (eventId !== session.googleEventId) await repo.updateCoachingSession(session.id, { googleEventId: eventId });
  } catch (e) {
    reportError(e);
  }
}

/** True when the calendar copy is behind the row (Studio offers "Sync again"). */
export const outOfSync = (s: CoachingSession, connected: boolean): boolean =>
  connected && (s.status === 'scheduled' ? s.googleEventId === null : s.googleEventId !== null);
