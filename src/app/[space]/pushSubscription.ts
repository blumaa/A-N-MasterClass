// Member push subscription writes (Launch 6 item 6). Space and profile come from the viewer
// (request Host + session), never from the browser.
import type { Viewer } from '@/lib/auth/viewer';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';

export type PushKeys = { endpoint: string; p256dh: string; auth: string };
export type PushSaveResult = { ok: true } | { ok: false; message: string };

/** Same cap as push_subscriptions_user_agent. */
const AGENT_MAX = 500;

const isText = (v: unknown): v is string => typeof v === 'string';

/** Endpoint and keys from PushSubscription.toJSON(). The DB checks length and https. */
export function parsePushKeys(json: unknown): PushKeys | null {
  if (typeof json !== 'object' || json === null) return null;
  const { endpoint, keys } = json as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!isText(endpoint) || !isText(keys?.p256dh) || !isText(keys?.auth)) return null;
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

export async function savePush(repo: Repo, viewer: Viewer, keys: PushKeys, userAgent: string | null): Promise<PushSaveResult> {
  if (!viewer.profile) return { ok: false, message: 'Sign in to turn on push.' };
  try {
    await repo.savePushSubscription({
      spaceId: viewer.space.id,
      profileId: viewer.profile.id,
      ...keys,
      userAgent: userAgent?.slice(0, AGENT_MAX) ?? null,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ConstraintError) return { ok: false, message: 'This browser gave an invalid push subscription.' };
    throw error;
  }
}

export async function forgetPush(repo: Repo, viewer: Viewer, endpoint: string): Promise<void> {
  if (viewer.profile) await repo.deletePushSubscription(viewer.profile.id, endpoint);
}

export async function isPushSaved(repo: Repo, viewer: Viewer, endpoint: string): Promise<boolean> {
  return viewer.profile ? repo.hasPushSubscription(viewer.space.id, viewer.profile.id, endpoint) : false;
}
