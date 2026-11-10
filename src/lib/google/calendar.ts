// Google OAuth 2.0 (web server flow) + Calendar API v3 client (G19). Only the calls coaching
// needs: consent URL, code exchange, refresh, free/busy, event insert/patch/delete, revoke.
// Errors throw GoogleApiError, never swallowed. fetch is injected so tests run offline.
// Docs: https://developers.google.com/identity/protocols/oauth2/web-server
//       https://developers.google.com/workspace/calendar/api/v3/reference
import type { Busy } from '@/lib/scheduling/slots';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

/** Least access that works: read busy time, write events on calendars the coach owns, know the account. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
] as const;

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
  ) {
    super(`Google API ${status}${reason ? `: ${reason}` : ''}`);
    this.name = 'GoogleApiError';
  }
}

export type GoogleOAuthConfig = { clientId: string; clientSecret: string };

export type CalendarEvent = {
  summary: string;
  description: string;
  location: string | null;
  start: Date;
  end: Date;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Consent screen URL. offline + consent = Google returns a refresh token every time. */
export function googleAuthUrl(config: Pick<GoogleOAuthConfig, 'clientId'>, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function failure(res: Response): Promise<GoogleApiError> {
  const body = obj(await res.json().catch(() => null));
  const error = body.error;
  // OAuth endpoints: { error: "invalid_grant" }; Calendar API: { error: { status, message } }.
  const reason = str(error) ?? str(obj(error).status) ?? str(obj(error).message);
  return new GoogleApiError(res.status, reason);
}

/** Email claim of an id_token received straight from Google's token endpoint over TLS (no signature check needed). */
function emailOf(idToken: string | null): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    return str(obj(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))).email);
  } catch {
    return null;
  }
}

const eventBody = (e: CalendarEvent) =>
  JSON.stringify({
    summary: e.summary,
    description: e.description,
    location: e.location ?? undefined,
    start: { dateTime: e.start.toISOString() },
    end: { dateTime: e.end.toISOString() },
  });

export type GoogleClient = ReturnType<typeof createGoogleClient>;

export function createGoogleClient(config: GoogleOAuthConfig, fetchImpl: typeof fetch = fetch) {
  async function token(params: Record<string, string>): Promise<Json> {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }).toString(),
    });
    if (!res.ok) throw await failure(res);
    return obj(await res.json());
  }

  async function api(accessToken: string, path: string, method: string, body?: string): Promise<Response> {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw await failure(res);
    return res;
  }

  const eventPath = (calendarId: string, eventId?: string) =>
    `/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`;

  return {
    async exchangeCode(code: string, redirectUri: string): Promise<{ refreshToken: string; accountEmail: string }> {
      const body = await token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      const refreshToken = str(body.refresh_token);
      if (!refreshToken) throw new GoogleApiError(200, 'no_refresh_token');
      const accountEmail = emailOf(str(body.id_token));
      if (!accountEmail) throw new GoogleApiError(200, 'no_email');
      const granted = new Set((str(body.scope) ?? '').split(' '));
      // The consent screen lets people untick scopes; without both calendar scopes nothing works.
      if (!GOOGLE_SCOPES.slice(2).every((s) => granted.has(s))) throw new GoogleApiError(200, 'scopes_not_granted');
      return { refreshToken, accountEmail };
    },

    async accessToken(refreshToken: string): Promise<string> {
      const value = str((await token({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token);
      if (!value) throw new GoogleApiError(200, 'no_access_token');
      return value;
    },

    async freeBusy(accessToken: string, calendarId: string, from: Date, to: Date): Promise<Busy[]> {
      const res = await api(
        accessToken,
        '/freeBusy',
        'POST',
        JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId }] }),
      );
      const cal = obj(obj(obj(await res.json()).calendars)[calendarId]);
      // Per-calendar errors come back with 200; an unreadable calendar is not "free".
      const errors = Array.isArray(cal.errors) ? cal.errors : [];
      if (errors.length > 0) throw new GoogleApiError(200, str(obj(errors[0]).reason) ?? 'freebusy_error');
      const busy = Array.isArray(cal.busy) ? cal.busy : [];
      return busy.map((b) => ({ start: new Date(String(obj(b).start)), end: new Date(String(obj(b).end)) }));
    },

    async insertEvent(accessToken: string, calendarId: string, event: CalendarEvent): Promise<string> {
      const id = str(obj(await (await api(accessToken, eventPath(calendarId), 'POST', eventBody(event))).json()).id);
      if (!id) throw new GoogleApiError(200, 'no_event_id');
      return id;
    },

    async patchEvent(accessToken: string, calendarId: string, eventId: string, event: CalendarEvent): Promise<void> {
      await api(accessToken, eventPath(calendarId, eventId), 'PATCH', eventBody(event));
    },

    async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
      await api(accessToken, eventPath(calendarId, eventId), 'DELETE');
    },

    async revoke(refreshToken: string): Promise<void> {
      const res = await fetchImpl(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }).toString(),
      });
      if (!res.ok) throw await failure(res);
    },
  };
}

/** Event already gone in Google (deleted by hand): 404 or 410. */
export const isGone = (e: unknown): boolean => e instanceof GoogleApiError && (e.status === 404 || e.status === 410);
