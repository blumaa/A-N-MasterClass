// The viewer's own time zone (browser Intl) for client-facing times. An inline script in the
// space layout stores it in a cookie on every full page load; pages read the cookie and format
// on the server, so there is no hydration mismatch and no flash. No cookie yet (the very first
// request on a host) or a bad value: null, and the caller shows the event's own zone (labelled).
import { isTimeZone } from '@/lib/format/zoned';

export const VIEWER_ZONE_COOKIE = 'tz';

/** Zone names are plain cookie-safe text (letters, digits, / _ - +), so no encoding. */
export const VIEWER_ZONE_SCRIPT = `try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z)document.cookie="${VIEWER_ZONE_COOKIE}="+z+";path=/;max-age=31536000;samesite=lax"}catch(e){}`;

export function pickViewerZone(cookie: string | undefined): string | null {
  return cookie && isTimeZone(cookie) ? cookie : null;
}
