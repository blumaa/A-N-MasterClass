'use server';
// Sign-in, sign-out and set-password (Supabase Auth). Accounts are made by purchase or grant
// (G4), never by self sign-up. Login is per host because the session cookies are (G2).
import { redirect } from 'next/navigation';
import { dataSource } from '@/config/dataSource';
import { endSession, passwordSignIn, sessionProfileId, setPassword } from '@/lib/auth/session';
import { libraryHref, signInHref } from '@/lib/routes';
import { parseNewPassword, parseSignIn } from './forms';

export type AuthFormState = { message: string } | null;

const WRONG = 'That email and password do not match.';

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (dataSource() !== 'supabase') return { message: 'Password sign-in needs Supabase.' };
  const input = parseSignIn(form);
  if (!input.ok) return { message: input.message };
  if (!(await passwordSignIn(input.email, input.password))) return { message: WRONG };
  redirect(libraryHref);
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect('/');
}

export async function setPasswordAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!(await sessionProfileId())) redirect(signInHref);
  const input = parseNewPassword(form);
  if (!input.ok) return { message: input.message };
  const result = await setPassword(input.password);
  if (!result.ok) return { message: result.message };
  redirect(libraryHref);
}
