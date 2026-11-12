// Where a notification tap is parked when the app was not running to hear it. Ported from
// kinbaku-study-group src/lib/push/pendingTap.ts.
// iOS launches a standalone PWA at the manifest start_url and drops the tap url, and
// WindowClient.navigate() does nothing there. So the worker writes the url to Cache Storage
// before opening anything, and the app reads it on boot (NotificationTap).
// The worker (serviceWorker.ts) is a plain string and cannot import this file: the cache name
// and key are copied there by hand. serviceWorker.test.ts and pendingTap.test.ts hold the two together.

export const PENDING_TAP_CACHE = 'masterclass-notification-tap';
/** Cache keys are requests, so a path. Under /__masterclass/ so it never meets a route. */
export const PENDING_TAP_KEY = '/__masterclass/notification-tap';
/** Covers a cold start on a slow phone, nothing longer: an old tap must not move a later launch. */
export const PENDING_TAP_TTL_MS = 60_000;

/**
 * Path + query + hash of an absolute url on this origin, else null. Parsed with no base, so a
 * relative or malformed string is refused, not resolved into something that looks local.
 */
export function sameOriginPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !URL.canParse(raw)) return null;
  const url = new URL(raw);
  return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
}

/**
 * Reads and consumes the parked tap: the path to open, or null. Deleted before it is judged, so a
 * stale, foreign or broken entry is spent too. Null when Cache Storage is missing (Safari private
 * browsing, insecure context) or refuses: no parked tap is the normal case on every boot.
 */
export async function takePendingTap(now: number = Date.now()): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  let entry: unknown;
  try {
    const cache = await caches.open(PENDING_TAP_CACHE);
    const hit = await cache.match(PENDING_TAP_KEY);
    if (!hit) return null;
    await cache.delete(PENDING_TAP_KEY);
    entry = JSON.parse(await hit.text());
  } catch {
    // Cache Storage refused or the entry is not JSON: nothing to act on.
    return null;
  }
  if (typeof entry !== 'object' || entry === null) return null;
  const { url, ts } = entry as Record<string, unknown>;
  if (typeof ts !== 'number' || now - ts > PENDING_TAP_TTL_MS) return null;
  return sameOriginPath(url);
}
