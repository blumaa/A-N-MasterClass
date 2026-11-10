// Google Calendar OAuth config SSOT (G19). Only module that reads GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET and OAUTH_STATE_SECRET. All unset = calendar sync off (not an error).

type Env = Record<string, string | undefined>;

export type GoogleConfig = { clientId: string; clientSecret: string; stateSecret: string };

const KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OAUTH_STATE_SECRET'] as const;
/** HMAC key length floor (32 bytes as hex/base64 is longer than this). */
const MIN_SECRET = 32;

export function readGoogleConfig(env: Env): GoogleConfig | null {
  const values = KEYS.map((k) => env[k]?.trim() ?? '');
  if (values.every((v) => v === '')) return null;
  const missing = KEYS.filter((_, i) => values[i] === '');
  if (missing.length > 0) throw new Error(`Google Calendar is half configured; missing ${missing.join(', ')}`);
  const [clientId, clientSecret, stateSecret] = values as [string, string, string];
  if (stateSecret.length < MIN_SECRET) throw new Error(`OAUTH_STATE_SECRET must be at least ${MIN_SECRET} characters`);
  return { clientId, clientSecret, stateSecret };
}

export const googleConfig = (): GoogleConfig | null => readGoogleConfig(process.env);

/** Fixed redirect URI registered in Google Cloud: one per platform, never per space domain. */
export const googleRedirectUri = (platformOrigin: string): string => `${platformOrigin}/api/google/callback`;
