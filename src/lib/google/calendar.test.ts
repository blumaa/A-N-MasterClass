// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createGoogleClient, GOOGLE_SCOPES, googleAuthUrl, GoogleApiError, isGone } from './calendar';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const idToken = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const CONFIG = { clientId: 'cid', clientSecret: 'csecret' };
const ALL_SCOPES = GOOGLE_SCOPES.join(' ');

function client(...responses: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const r of responses) fetchImpl.mockResolvedValueOnce(r);
  return { google: createGoogleClient(CONFIG, fetchImpl), fetchImpl };
}
const sent = (f: ReturnType<typeof vi.fn<typeof fetch>>, i = 0) => {
  const [url, init] = f.mock.calls[i]!;
  return { url: String(url), init: init!, body: String(init!.body ?? '') };
};

describe('googleAuthUrl', () => {
  it('asks for offline access with consent and the minimal scopes', () => {
    const url = new URL(googleAuthUrl(CONFIG, 'https://p.test/api/google/callback', 'st'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'cid',
      redirect_uri: 'https://p.test/api/google/callback',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: 'st',
      scope: ALL_SCOPES,
    });
  });
});

describe('createGoogleClient', () => {
  it('exchanges a code for a refresh token and the account email', async () => {
    const { google, fetchImpl } = client(json({ access_token: 'a', refresh_token: 'r', scope: ALL_SCOPES, id_token: idToken({ email: 'coach@example.test' }) }));
    expect(await google.exchangeCode('code1', 'https://p.test/cb')).toEqual({ refreshToken: 'r', accountEmail: 'coach@example.test' });
    const { url, body } = sent(fetchImpl);
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
      client_id: 'cid',
      client_secret: 'csecret',
      grant_type: 'authorization_code',
      code: 'code1',
      redirect_uri: 'https://p.test/cb',
    });
  });

  it('refuses a consent without both calendar scopes', async () => {
    const { google } = client(json({ refresh_token: 'r', scope: 'openid email', id_token: idToken({ email: 'c@x.test' }) }));
    await expect(google.exchangeCode('c', 'u')).rejects.toMatchObject({ reason: 'scopes_not_granted' });
  });

  it('turns an OAuth error into GoogleApiError', async () => {
    const { google } = client(json({ error: 'invalid_grant' }, 400));
    await expect(google.accessToken('r')).rejects.toEqual(new GoogleApiError(400, 'invalid_grant'));
  });

  it('reads busy intervals and fails on a per-calendar error', async () => {
    const { google, fetchImpl } = client(
      json({ calendars: { primary: { busy: [{ start: '2026-11-11T09:00:00Z', end: '2026-11-11T10:00:00Z' }] } } }),
      json({ calendars: { primary: { errors: [{ reason: 'notFound' }] } } }),
    );
    const from = new Date('2026-11-10T00:00:00Z');
    const to = new Date('2026-11-20T00:00:00Z');
    expect(await google.freeBusy('tok', 'primary', from, to)).toEqual([
      { start: new Date('2026-11-11T09:00:00Z'), end: new Date('2026-11-11T10:00:00Z') },
    ]);
    const { url, init, body } = sent(fetchImpl);
    expect(url).toBe('https://www.googleapis.com/calendar/v3/freeBusy');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(JSON.parse(body)).toEqual({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: 'primary' }] });
    await expect(google.freeBusy('tok', 'primary', from, to)).rejects.toMatchObject({ reason: 'notFound' });
  });

  it('inserts, patches and deletes events', async () => {
    const { google, fetchImpl } = client(json({ id: 'evt1' }), json({ id: 'evt1' }), new Response(null, { status: 204 }), json({ error: { status: 'NOT_FOUND' } }, 404));
    const event = { summary: 'Session', description: 'knots', location: null, start: new Date('2026-11-11T08:00:00Z'), end: new Date('2026-11-11T09:00:00Z') };
    expect(await google.insertEvent('tok', 'primary', event)).toBe('evt1');
    expect(JSON.parse(sent(fetchImpl).body)).toEqual({
      summary: 'Session',
      description: 'knots',
      start: { dateTime: '2026-11-11T08:00:00.000Z' },
      end: { dateTime: '2026-11-11T09:00:00.000Z' },
    });
    await google.patchEvent('tok', 'primary', 'evt1', event);
    expect(sent(fetchImpl, 1)).toMatchObject({ url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events/evt1', init: { method: 'PATCH' } });
    await google.deleteEvent('tok', 'primary', 'evt1');
    const gone = await google.deleteEvent('tok', 'primary', 'evt1').catch((e: unknown) => e);
    expect(isGone(gone)).toBe(true);
  });

  it('revokes a refresh token', async () => {
    const { google, fetchImpl } = client(new Response(null, { status: 200 }));
    await google.revoke('r');
    expect(sent(fetchImpl)).toMatchObject({ url: 'https://oauth2.googleapis.com/revoke', body: 'token=r' });
  });
});
