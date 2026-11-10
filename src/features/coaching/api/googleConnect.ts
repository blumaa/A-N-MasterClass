// Google Calendar connect / disconnect (G19). Starts on the space host (Studio), consent at
// Google, returns to the fixed platform callback, then back to Studio. Connecting is a space
// setting (settings.manage). The callback re-checks the role: the state proves who started
// the flow, not that they may still connect.
import { resolveViewer, viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import type { Repo } from '@/lib/data/repo';
import type { GoogleClient } from '@/lib/google/calendar';
import { reportError } from '@/lib/errors/report';
import { createState, readState } from '@/lib/google/state';

/** Studio query flag shown after the round trip. */
export type ConnectOutcome = 'connected' | 'denied' | 'failed';

/** Signed state for a viewer allowed to connect, else null. */
export function startConnect(viewer: Viewer, stateSecret: string, returnTo: string, now: Date): string | null {
  if (!viewer.profile || !viewerCan(viewer, 'settings.manage')) return null;
  return createState({ spaceSlug: viewer.space.slug, profileId: viewer.profile.id, returnTo }, stateSecret, now);
}

export type Callback = {
  state: string | null;
  code: string | null;
  /** `error` query param from Google (access_denied when the coach cancels). */
  error: string | null;
  /** Nonce cookie set by the connect route on this browser. */
  nonce: string | null;
};

/**
 * Where to send the browser after Google: Studio with an outcome, or null when the request
 * is not a valid continuation of a flow we started (no trusted returnTo to go back to).
 */
export async function finishConnect(
  repo: Repo,
  google: Pick<GoogleClient, 'exchangeCode'>,
  stateSecret: string,
  redirectUri: string,
  cb: Callback,
  now: Date,
): Promise<string | null> {
  const state = cb.state ? readState(cb.state, stateSecret, now) : null;
  if (!state || !cb.nonce || cb.nonce !== state.nonce) return null;
  const back = (outcome: ConnectOutcome) => {
    const url = new URL(state.returnTo);
    url.searchParams.set('calendar', outcome);
    return url.toString();
  };
  if (cb.error || !cb.code) return back('denied');
  const viewer = await resolveViewer(repo, state.spaceSlug, state.profileId);
  if (!viewer || !viewerCan(viewer, 'settings.manage')) return back('failed');
  try {
    const { refreshToken, accountEmail } = await google.exchangeCode(cb.code, redirectUri);
    await repo.saveCalendarConnection(
      { spaceId: viewer.space.id, provider: 'google', accountEmail, calendarId: 'primary', connectedAt: now },
      refreshToken,
    );
    return back('connected');
  } catch (e) {
    reportError(e);
    return back('failed');
  }
}

/** Revokes at Google (best effort, reported) and always forgets the connection. */
export async function disconnectCalendar(repo: Repo, viewer: Viewer, google: Pick<GoogleClient, 'revoke'> | null): Promise<CommandResult> {
  if (!viewer.profile || !viewerCan(viewer, 'settings.manage')) return { ok: false, error: 'forbidden' };
  const token = await repo.calendarRefreshToken(viewer.space.id);
  if (token && google) await google.revoke(token).catch(reportError);
  await repo.deleteCalendarConnection(viewer.space.id);
  return { ok: true };
}
