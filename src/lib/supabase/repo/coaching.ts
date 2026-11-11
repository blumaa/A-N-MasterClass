// Supabase Repo: coaching programs, scheduler settings, availability, sessions, notes, Google Calendar.
// Semantics mirror src/lib/data/fake/fakeCoachingRepo.ts; constraints come from the *_coaching.sql migration.
import type { Repo } from '@/lib/data/repo';
import { check, defined, isoOrNull, unwrap, unwrapMaybe, type RepoCtx } from './context';
import {
  toAvailabilityOverride,
  toAvailabilityRule,
  toCalendarConnection,
  toCoachSettings,
  toCoachingProgram,
  toCoachingSession,
  toSessionNote,
} from './mapCoaching';

export type CoachingRepo = Pick<
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

// Columns without token_id (the Vault secret id never leaves the database layer).
const CONNECTION_COLUMNS = 'space_id, provider, account_email, calendar_id, connected_at';

export function createCoachingRepo({ db, admin }: RepoCtx): CoachingRepo {
  return {
    async coachingProgram(productId) {
      const row = unwrapMaybe(
        await (await db()).from('coaching_programs').select('*').eq('product_id', productId).maybeSingle(),
      );
      return row && toCoachingProgram(row);
    },
    async saveCoachingProgram(row) {
      check(
        await (await db()).from('coaching_programs').upsert(
          {
            product_id: row.productId,
            kind: row.kind,
            session_minutes: row.sessionMinutes,
            sessions_included: row.sessionsIncluded,
            location: row.location,
          },
          { onConflict: 'product_id' },
        ),
      );
    },

    async coachSettings(spaceId) {
      const row = unwrapMaybe(
        await (await db()).from('coach_settings').select('*').eq('space_id', spaceId).maybeSingle(),
      );
      return row && toCoachSettings(row);
    },
    async saveCoachSettings(row) {
      check(
        await (await db()).from('coach_settings').upsert(
          {
            space_id: row.spaceId,
            time_zone: row.timeZone,
            buffer_before_min: row.bufferBeforeMin,
            buffer_after_min: row.bufferAfterMin,
            min_notice_min: row.minNoticeMin,
            window_days: row.windowDays,
            cancel_cutoff_hours: row.cancelCutoffHours,
          },
          { onConflict: 'space_id' },
        ),
      );
    },

    async availabilityRules(spaceId) {
      return unwrap(
        await (await db())
          .from('availability_rules')
          .select('*')
          .eq('space_id', spaceId)
          .order('weekday')
          .order('start_minute'),
      ).map(toAvailabilityRule);
    },
    async createAvailabilityRule(input) {
      const row = unwrap(
        await (await db())
          .from('availability_rules')
          .insert({
            space_id: input.spaceId,
            weekday: input.weekday,
            start_minute: input.startMinute,
            end_minute: input.endMinute,
          })
          .select('*')
          .single(),
      );
      return toAvailabilityRule(row);
    },
    async deleteAvailabilityRule(id) {
      check(await (await db()).from('availability_rules').delete().eq('id', id));
    },

    async availabilityOverrides(spaceId) {
      return unwrap(
        await (await db())
          .from('availability_overrides')
          .select('*')
          .eq('space_id', spaceId)
          .order('date')
          // Day-off rows (null start) first within a date, like the fake.
          .order('start_minute', { ascending: true, nullsFirst: true }),
      ).map(toAvailabilityOverride);
    },
    async createAvailabilityOverride(input) {
      const row = unwrap(
        await (await db())
          .from('availability_overrides')
          .insert({
            space_id: input.spaceId,
            date: input.date,
            start_minute: input.startMinute,
            end_minute: input.endMinute,
          })
          .select('*')
          .single(),
      );
      return toAvailabilityOverride(row);
    },
    async deleteAvailabilityOverride(id) {
      check(await (await db()).from('availability_overrides').delete().eq('id', id));
    },

    async coachingSessions(where) {
      let q = (await db()).from('coaching_sessions').select('*').eq('space_id', where.spaceId);
      if (where.productId !== undefined) q = q.eq('product_id', where.productId);
      if (where.clientId !== undefined) q = q.eq('client_id', where.clientId);
      return unwrap(await q.order('starts_at')).map(toCoachingSession);
    },
    async coachingSession(id) {
      const row = unwrapMaybe(await (await db()).from('coaching_sessions').select('*').eq('id', id).maybeSingle());
      return row && toCoachingSession(row);
    },
    async createCoachingSession(input) {
      const row = unwrap(
        await (await db())
          .from('coaching_sessions')
          .insert({
            product_id: input.productId,
            space_id: input.spaceId,
            client_id: input.clientId,
            title: input.title,
            starts_at: input.startsAt.toISOString(),
            ends_at: input.endsAt.toISOString(),
            agenda: input.agenda,
            location: input.location,
            created_at: input.createdAt.toISOString(),
          })
          .select('*')
          .single(),
      );
      return toCoachingSession(row);
    },
    // RPC acts as the signed-in client (auth.uid()), so db() must be the user session.
    // The RPC takes only product, start, end and agenda: title, location and client come from the
    // product/program/session user, and the grant is checked at now().
    async bookCoachingSession(input) {
      const row = unwrap(
        await (await db())
          .rpc('book_coaching_session', {
            target_product: input.productId,
            starts: input.startsAt.toISOString(),
            ends: input.endsAt.toISOString(),
            agenda: input.agenda,
          }),
      );
      return toCoachingSession(row);
    },
    async updateCoachingSession(id, patch) {
      const row = unwrap(
        await (await db())
          .from('coaching_sessions')
          .update(
            defined({
              title: patch.title,
              starts_at: patch.startsAt?.toISOString(),
              ends_at: patch.endsAt?.toISOString(),
              location: patch.location,
              agenda: patch.agenda,
              status: patch.status,
              cancelled_at: isoOrNull(patch.cancelledAt),
              google_event_id: patch.googleEventId,
            }),
          )
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toCoachingSession(row);
    },

    async sessionNote(sessionId) {
      const row = unwrapMaybe(
        await (await db()).from('session_notes').select('*').eq('session_id', sessionId).maybeSingle(),
      );
      return row && toSessionNote(row);
    },
    async saveSessionNote(row) {
      check(
        await (await db()).from('session_notes').upsert(
          { session_id: row.sessionId, body: row.body, updated_at: row.updatedAt.toISOString() },
          { onConflict: 'session_id' },
        ),
      );
    },

    async calendarConnection(spaceId) {
      const row = unwrapMaybe(
        await (await db()).from('calendar_connections').select(CONNECTION_COLUMNS).eq('space_id', spaceId).maybeSingle(),
      );
      return row && toCalendarConnection(row);
    },
    // admin(): the Vault secret is readable by service_role only, whoever calls.
    async calendarRefreshToken(spaceId) {
      const { data, error } = await admin().rpc('calendar_token', { target_space: spaceId });
      check({ error });
      return data ?? null;
    },
    // admin(): save_calendar_connection writes Vault and is granted to service_role only.
    // The RPC stamps connected_at with now(); row.connectedAt is ignored.
    async saveCalendarConnection(row, refreshToken) {
      check(
        await admin().rpc('save_calendar_connection', {
          target_space: row.spaceId,
          email: row.accountEmail,
          calendar: row.calendarId,
          token: refreshToken,
        }),
      );
    },
    async deleteCalendarConnection(spaceId) {
      check(await (await db()).from('calendar_connections').delete().eq('space_id', spaceId));
    },
  };
}
