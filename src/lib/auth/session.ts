// Session = who is signed in on this host. Cookies are host-scoped, so login is per domain (G2).
// fake: dev profile-id cookie (never production). supabase: Supabase Auth session cookies.
import 'server-only';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { dataSource, devAuthAllowed } from '@/config/dataSource';
import { adminClient } from '@/lib/supabase/admin';
import { signInAs } from '@/lib/supabase/auth/signInAs';
import { userClient } from '@/lib/supabase/server';

export const DEV_PROFILE_COOKIE = 'mc_dev_profile';

function assertDevAuth(): void {
  if (!devAuthAllowed(process.env)) throw new Error('dev login disabled (needs DATA_SOURCE=fake outside production)');
}

/** Can this deployment sign people in? Supabase always; fake data only in dev (never production). */
export const sessionsEnabled = (): boolean => dataSource() === 'supabase' || devAuthAllowed(process.env);

export const sessionProfileId = cache(async (): Promise<string | null> => {
  switch (dataSource()) {
    case 'fake':
      if (!devAuthAllowed(process.env)) return null;
      return (await cookies()).get(DEV_PROFILE_COOKIE)?.value ?? null;
    case 'supabase': {
      // getClaims verifies the JWT (never trust getSession on the server). A missing or invalid
      // session means signed out; only a failed request to Auth is an error.
      const { data, error } = await (await userClient()).auth.getClaims();
      if (error && isAuthRetryableFetchError(error)) throw error;
      return data?.claims.sub ?? null;
    }
  }
});

/** Sign in a profile the server already trusts (new buyer, claim link). Server Actions / Route Handlers only. */
export async function startSession(profileId: string): Promise<void> {
  switch (dataSource()) {
    case 'fake':
      assertDevAuth();
      (await cookies()).set(DEV_PROFILE_COOKIE, profileId, { httpOnly: true, sameSite: 'lax', path: '/' });
      return;
    case 'supabase':
      await signInAs(adminClient(), await userClient(), profileId);
  }
}

export async function endSession(): Promise<void> {
  switch (dataSource()) {
    case 'fake':
      assertDevAuth();
      (await cookies()).delete(DEV_PROFILE_COOKIE);
      return;
    case 'supabase': {
      // Local scope: this browser only, not the user's other devices or spaces.
      const { error } = await (await userClient()).auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
  }
}

/** Email + password sign-in (supabase). Returns false for wrong credentials. */
export async function passwordSignIn(email: string, password: string): Promise<boolean> {
  const { error } = await (await userClient()).auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (!error) return true;
  if (error.code === 'invalid_credentials') return false;
  throw error;
}

export type SetPasswordResult = { ok: true } | { ok: false; message: string };

/** Signed-in user sets or changes their password (after checkout or claim, G4). */
export async function setPassword(password: string): Promise<SetPasswordResult> {
  const { error } = await (await userClient()).auth.updateUser({ password });
  if (!error) return { ok: true };
  if (error.code === 'weak_password' || error.code === 'same_password') return { ok: false, message: error.message };
  throw error;
}
