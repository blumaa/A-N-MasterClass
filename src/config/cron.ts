// Cron secret SSOT. Only module that reads CRON_SECRET. Scheduled calls send
// `Authorization: Bearer <CRON_SECRET>` (the Vercel Cron convention). Unset = every call refused.
import { createHash, timingSafeEqual } from 'node:crypto';

type Env = Record<string, string | undefined>;

const MIN_LENGTH = 32;

export function readCronSecret(env: Env): string | null {
  const secret = env.CRON_SECRET?.trim() ?? '';
  if (secret === '') return null;
  if (secret.length < MIN_LENGTH) throw new Error(`CRON_SECRET must be at least ${MIN_LENGTH} characters (openssl rand -hex 32)`);
  return secret;
}

export const cronSecret = (): string | null => readCronSecret(process.env);

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time check of the Authorization header against the secret. */
export function isCronCall(authorization: string | null, secret: string | null): boolean {
  if (secret === null || authorization === null) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
