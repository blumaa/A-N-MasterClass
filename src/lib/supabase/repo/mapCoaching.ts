// Row (snake_case, ISO strings) -> domain type for the coaching tables.
import type {
  AvailabilityOverride,
  AvailabilityRule,
  CalendarConnection,
  CoachSettings,
  CoachingProgram,
  CoachingSession,
  SessionNote,
} from '@/lib/data/types';
import { toDate, toDateOrNull, type Row } from './context';

export const toCoachingProgram = (r: Row<'coaching_programs'>): CoachingProgram => ({
  productId: r.product_id,
  kind: r.kind as CoachingProgram['kind'],
  sessionMinutes: r.session_minutes,
  sessionsIncluded: r.sessions_included,
  location: r.location,
});

export const toCoachSettings = (r: Row<'coach_settings'>): CoachSettings => ({
  spaceId: r.space_id,
  timeZone: r.time_zone,
  bufferBeforeMin: r.buffer_before_min,
  bufferAfterMin: r.buffer_after_min,
  minNoticeMin: r.min_notice_min,
  windowDays: r.window_days,
  cancelCutoffHours: r.cancel_cutoff_hours,
});

export const toAvailabilityRule = (r: Row<'availability_rules'>): AvailabilityRule => ({
  id: r.id,
  spaceId: r.space_id,
  weekday: r.weekday,
  startMinute: r.start_minute,
  endMinute: r.end_minute,
});

export const toAvailabilityOverride = (r: Row<'availability_overrides'>): AvailabilityOverride => ({
  id: r.id,
  spaceId: r.space_id,
  date: r.date,
  startMinute: r.start_minute,
  endMinute: r.end_minute,
});

export const toCoachingSession = (r: Row<'coaching_sessions'>): CoachingSession => ({
  id: r.id,
  productId: r.product_id,
  spaceId: r.space_id,
  clientId: r.client_id,
  title: r.title,
  startsAt: toDate(r.starts_at),
  endsAt: toDate(r.ends_at),
  status: r.status as CoachingSession['status'],
  agenda: r.agenda,
  location: r.location,
  googleEventId: r.google_event_id,
  createdAt: toDate(r.created_at),
  cancelledAt: toDateOrNull(r.cancelled_at),
});

export const toSessionNote = (r: Row<'session_notes'>): SessionNote => ({
  sessionId: r.session_id,
  body: r.body,
  updatedAt: toDate(r.updated_at),
});

/** token_id is never selected, so it cannot reach this mapper. */
export const toCalendarConnection = (
  r: Pick<Row<'calendar_connections'>, 'space_id' | 'provider' | 'account_email' | 'calendar_id' | 'connected_at'>,
): CalendarConnection => ({
  spaceId: r.space_id,
  provider: r.provider as CalendarConnection['provider'],
  accountEmail: r.account_email,
  calendarId: r.calendar_id,
  connectedAt: toDate(r.connected_at),
});
