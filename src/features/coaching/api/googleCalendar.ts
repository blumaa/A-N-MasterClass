// CalendarPort backed by the space's Google Calendar (G19). No connection = behaves like
// NO_CALENDAR. Failures throw: busy() failing makes booking fail closed, sync() failing is
// reported by syncToCalendar and shown as "not synced" in Studio.
import { spaceNames } from '@/lib/data/names';
import type { Repo } from '@/lib/data/repo';
import type { CoachingSession } from '@/lib/data/types';
import { isGone, type CalendarEvent, type GoogleClient } from '@/lib/google/calendar';
import { NO_CALENDAR, type CalendarPort } from './schedule';

type Client = Pick<GoogleClient, 'accessToken' | 'freeBusy' | 'insertEvent' | 'patchEvent' | 'deleteEvent'>;

async function eventOf(repo: Repo, s: CoachingSession): Promise<CalendarEvent> {
  const client = s.clientId ? (await spaceNames(repo, s.spaceId)).get(s.clientId) : undefined;
  return {
    summary: client ? `${s.title} with ${client}` : s.title,
    description: [s.agenda, s.location].filter(Boolean).join('\n\n'),
    location: s.location,
    start: s.startsAt,
    end: s.endsAt,
  };
}

export function googleCalendarPort(repo: Repo, google: Client): CalendarPort {
  /** Access token + calendar id, or null when the space is not connected. */
  async function session(spaceId: string) {
    const [connection, refreshToken] = await Promise.all([repo.calendarConnection(spaceId), repo.calendarRefreshToken(spaceId)]);
    if (!connection || !refreshToken) return null;
    return { token: await google.accessToken(refreshToken), calendarId: connection.calendarId };
  }

  return {
    async busy(spaceId, from, to) {
      const g = await session(spaceId);
      return g ? google.freeBusy(g.token, g.calendarId, from, to) : [];
    },

    async sync(s) {
      const g = await session(s.spaceId);
      if (!g) return s.googleEventId;
      if (s.status === 'cancelled') {
        if (s.googleEventId) {
          await google.deleteEvent(g.token, g.calendarId, s.googleEventId).catch((e: unknown) => {
            if (!isGone(e)) throw e;
          });
        }
        return null;
      }
      const event = await eventOf(repo, s);
      if (s.googleEventId) {
        try {
          await google.patchEvent(g.token, g.calendarId, s.googleEventId, event);
          return s.googleEventId;
        } catch (e) {
          // Deleted by hand in Google: create it again.
          if (!isGone(e)) throw e;
        }
      }
      return google.insertEvent(g.token, g.calendarId, event);
    },
  };
}

/** Port for the current config: Google when configured, otherwise none. */
export const calendarPortFor = (repo: Repo, google: Client | null): CalendarPort => (google ? googleCalendarPort(repo, google) : NO_CALENDAR);
