// Client side of coaching (G18, G19, Kajabi Scheduler): a coaching product's page with the
// client's sessions, the group sessions of the product, remaining 1:1 sessions and open slots.
// Clients book, reschedule and cancel their own 1:1 sessions until the coach's cutoff.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { CoachingProgram, CoachingSession, CoachSettings, Product } from '@/lib/data/types';
import { icsFor } from '@/lib/calendar/ics';
import { reportError } from '@/lib/errors/report';
import { coachSettingsOf, openSlots, syncToCalendar, type CalendarPort } from './schedule';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export type ClientSession = Omit<CoachingSession, 'googleEventId'> & { changeable: boolean };

export type ClientCoaching = {
  product: Product;
  program: CoachingProgram;
  settings: Pick<CoachSettings, 'timeZone' | 'cancelCutoffHours'>;
  hasAccess: boolean;
  isEditor: boolean;
  upcoming: ClientSession[];
  past: ClientSession[];
  /** 1:1 sessions still bookable; 0 for group programs. */
  remaining: number;
  slots: Date[];
  /** Google Calendar unreachable: no slots offered rather than risk a double booking. */
  calendarDown: boolean;
};

/** Client may still move or cancel: scheduled, own 1:1 session, before the cutoff. */
export const changeable = (s: Pick<CoachingSession, 'status' | 'clientId' | 'startsAt'>, me: string | undefined, cutoffHours: number, now: Date): boolean =>
  s.status === 'scheduled' && me !== undefined && s.clientId === me && s.startsAt.getTime() - now.getTime() >= cutoffHours * HOUR_MS;

async function coachingProduct(repo: Repo, viewer: Viewer, find: () => Promise<Product | null>) {
  const product = await find();
  if (!product || product.kind !== 'coaching' || product.spaceId !== viewer.space.id) return null;
  const isEditor = viewerCan(viewer, 'products.edit');
  if (product.status !== 'published' && !isEditor) return null;
  const program = await repo.coachingProgram(product.id);
  return program ? { product, program, isEditor } : null;
}

type Offered = { slots: Date[]; calendarDown: boolean };
const NO_SLOTS: Offered = { slots: [], calendarDown: false };

/** Open slots for the client, failing closed: calendar unreachable = no slots + calendarDown. */
async function offered(repo: Repo, calendar: CalendarPort, spaceId: string, minutes: number, now: Date, except: string | null): Promise<Offered> {
  try {
    return { slots: (await openSlots(repo, calendar, spaceId, minutes, now, except)).slots, calendarDown: false };
  } catch (e) {
    reportError(e);
    return { slots: [], calendarDown: true };
  }
}

export async function clientCoaching(
  repo: Repo,
  viewer: Viewer,
  calendar: CalendarPort,
  slug: string,
  now: Date,
): Promise<ClientCoaching | null> {
  const found = await coachingProduct(repo, viewer, () => repo.productBySlug(viewer.space.id, slug));
  if (!found) return null;
  const { product, program, isEditor } = found;
  const me = viewer.profile?.id;
  const [grant, settings, sessions] = await Promise.all([
    me ? repo.activeGrant(product.id, me, now) : null,
    coachSettingsOf(repo, viewer.space.id),
    repo.coachingSessions({ spaceId: viewer.space.id, productId: product.id }),
  ]);
  const hasAccess = grant !== null;
  const mine = hasAccess || isEditor ? sessions.filter((s) => s.clientId === null || (me !== undefined && s.clientId === me)) : [];
  const toClient = ({ googleEventId: _g, ...s }: CoachingSession): ClientSession => ({
    ...s,
    changeable: changeable(s, me, settings.cancelCutoffHours, now),
  });
  const remaining =
    program.kind === 'one_on_one' && hasAccess
      ? Math.max(0, program.sessionsIncluded - sessions.filter((s) => s.clientId === me && s.status === 'scheduled').length)
      : 0;

  const { slots, calendarDown } =
    remaining > 0 ? await offered(repo, calendar, viewer.space.id, program.sessionMinutes, now, null) : NO_SLOTS;
  return {
    product,
    program,
    settings: { timeZone: settings.timeZone, cancelCutoffHours: settings.cancelCutoffHours },
    hasAccess,
    isEditor,
    upcoming: mine.filter((s) => s.status === 'scheduled' && s.endsAt > now).map(toClient),
    past: mine.filter((s) => s.status === 'cancelled' || s.endsAt <= now).toReversed().map(toClient),
    remaining,
    slots,
    calendarDown,
  };
}

/** Library section: published coaching products the viewer holds an active grant for. */
export async function myCoaching(repo: Repo, viewer: Viewer, now: Date): Promise<Product[]> {
  const me = viewer.profile?.id;
  if (!me) return [];
  const coaching = (await repo.products(viewer.space.id)).filter((p) => p.kind === 'coaching' && p.status === 'published');
  const grants = await Promise.all(coaching.map((p) => repo.activeGrant(p.id, me, now)));
  return coaching.filter((_, i) => grants[i] !== null);
}

/** One session the viewer may see (own 1:1 or a group session of a product they hold). */
export async function clientSession(repo: Repo, viewer: Viewer, sessionId: string, now: Date): Promise<ClientSession | null> {
  const session = await repo.coachingSession(sessionId);
  if (!session || session.spaceId !== viewer.space.id) return null;
  const me = viewer.profile?.id;
  const isEditor = viewerCan(viewer, 'products.edit');
  const grant = me ? await repo.activeGrant(session.productId, me, now) : null;
  const visible = isEditor || (grant !== null && (session.clientId === null || session.clientId === me));
  if (!visible) return null;
  const settings = await coachSettingsOf(repo, viewer.space.id);
  const { googleEventId: _g, ...rest } = session;
  return { ...rest, changeable: changeable(session, me, settings.cancelCutoffHours, now) };
}

/** "Add to calendar" file for a scheduled session the viewer may see. Points at the session page. */
export async function sessionIcs(repo: Repo, viewer: Viewer, sessionId: string, pageUrl: string, now: Date): Promise<string | null> {
  const s = await clientSession(repo, viewer, sessionId, now);
  if (!s || s.status !== 'scheduled') return null;
  return icsFor({
    uid: `${s.id}@masterclass`,
    title: s.title,
    description: s.agenda ? `${s.agenda}\n\n${pageUrl}` : pageUrl,
    location: pageUrl,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    stamp: now,
  });
}

/** New times for one of the viewer's own sessions while it is still changeable (own time included). */
export async function rescheduleSlots(repo: Repo, viewer: Viewer, calendar: CalendarPort, sessionId: string, now: Date): Promise<Offered> {
  const session = await repo.coachingSession(sessionId);
  const me = viewer.profile?.id;
  if (!session || session.spaceId !== viewer.space.id) return NO_SLOTS;
  const settings = await coachSettingsOf(repo, viewer.space.id);
  if (!changeable(session, me, settings.cancelCutoffHours, now)) return NO_SLOTS;
  const minutes = (session.endsAt.getTime() - session.startsAt.getTime()) / MINUTE_MS;
  return offered(repo, calendar, viewer.space.id, minutes, now, session.id);
}

export type BookingCommand =
  | { op: 'book'; productId: string; startsAt: Date; agenda: string }
  | { op: 'reschedule'; sessionId: string; startsAt: Date }
  | { op: 'cancel'; sessionId: string };

const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };
const invalid = (message: string): CommandResult => ({ ok: false, error: 'invalid', message });

type SlotCheck = 'free' | 'taken' | 'calendar_down';

async function slotCheck(repo: Repo, calendar: CalendarPort, spaceId: string, minutes: number, start: Date, now: Date, except: string | null): Promise<SlotCheck> {
  try {
    const { slots } = await openSlots(repo, calendar, spaceId, minutes, now, except);
    return slots.some((d) => d.getTime() === start.getTime()) ? 'free' : 'taken';
  } catch (e) {
    reportError(e);
    return 'calendar_down';
  }
}

const SLOT_FAILURE: Record<Exclude<SlotCheck, 'free'>, CommandResult> = {
  taken: invalid('That time is no longer available. Pick another slot.'),
  calendar_down: invalid("The coach's calendar cannot be checked right now. Try again in a few minutes."),
};

async function book(repo: Repo, viewer: Viewer, calendar: CalendarPort, c: Extract<BookingCommand, { op: 'book' }>, me: string, now: Date) {
  const found = await coachingProduct(repo, viewer, () => repo.product(c.productId));
  if (!found) return NOT_FOUND;
  const { product, program } = found;
  const slot = await slotCheck(repo, calendar, viewer.space.id, program.sessionMinutes, c.startsAt, now, null);
  if (slot !== 'free') return SLOT_FAILURE[slot];
  const session = await repo.bookCoachingSession({
    productId: product.id,
    spaceId: viewer.space.id,
    clientId: me,
    title: product.title,
    startsAt: c.startsAt,
    endsAt: new Date(c.startsAt.getTime() + program.sessionMinutes * MINUTE_MS),
    agenda: c.agenda.trim(),
    location: program.location,
    createdAt: now,
  });
  await syncToCalendar(repo, calendar, session);
  return { ok: true as const, id: session.id };
}

async function change(repo: Repo, viewer: Viewer, calendar: CalendarPort, c: Exclude<BookingCommand, { op: 'book' }>, me: string, now: Date) {
  const session = await repo.coachingSession(c.sessionId);
  if (!session || session.spaceId !== viewer.space.id || session.clientId !== me) return NOT_FOUND;
  const settings = await coachSettingsOf(repo, viewer.space.id);
  if (!changeable(session, me, settings.cancelCutoffHours, now)) {
    return invalid(`Sessions can be changed until ${settings.cancelCutoffHours} hours before they start.`);
  }
  if (c.op === 'cancel') {
    await syncToCalendar(repo, calendar, await repo.updateCoachingSession(session.id, { status: 'cancelled', cancelledAt: now }));
    return { ok: true as const, id: session.id };
  }
  const minutes = (session.endsAt.getTime() - session.startsAt.getTime()) / MINUTE_MS;
  const slot = await slotCheck(repo, calendar, viewer.space.id, minutes, c.startsAt, now, session.id);
  if (slot !== 'free') return SLOT_FAILURE[slot];
  const moved = await repo.updateCoachingSession(session.id, {
    startsAt: c.startsAt,
    endsAt: new Date(c.startsAt.getTime() + minutes * MINUTE_MS),
  });
  await syncToCalendar(repo, calendar, moved);
  return { ok: true as const, id: session.id };
}

/**
 * Slot checked against the same grid the client was shown; calendar unreachable = refuse (fail
 * closed). Google sync after the write never fails the command (see syncToCalendar).
 */
export async function editBooking(repo: Repo, viewer: Viewer, calendar: CalendarPort, c: BookingCommand, now: Date): Promise<CommandResult> {
  const me = viewer.profile?.id;
  if (!me) return FORBIDDEN;
  try {
    return c.op === 'book' ? await book(repo, viewer, calendar, c, me, now) : await change(repo, viewer, calendar, c, me, now);
  } catch (e) {
    if (e instanceof ConstraintError) return invalid(e.message);
    throw e;
  }
}
