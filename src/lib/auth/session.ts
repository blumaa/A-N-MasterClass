// Session = who is signed in on this host. Dev: profile id cookie (DATA_SOURCE=fake only).
// REPLACED BY: Supabase Auth session once the DB exists.
import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { devAuthAllowed } from '@/config/dataSource';

export const DEV_PROFILE_COOKIE = 'mc_dev_profile';

function assertDevAuth(): void {
  if (!devAuthAllowed(process.env)) throw new Error('dev login disabled (needs DATA_SOURCE=fake outside production)');
}

export const sessionProfileId = cache(async (): Promise<string | null> => {
  if (!devAuthAllowed(process.env)) return null;
  return (await cookies()).get(DEV_PROFILE_COOKIE)?.value ?? null;
});

/** Call from a Server Action only (cookies can be set there). Cookie is host-scoped: login per domain (G2). */
export async function startDevSession(profileId: string): Promise<void> {
  assertDevAuth();
  (await cookies()).set(DEV_PROFILE_COOKIE, profileId, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export async function endDevSession(): Promise<void> {
  assertDevAuth();
  (await cookies()).delete(DEV_PROFILE_COOKIE);
}
