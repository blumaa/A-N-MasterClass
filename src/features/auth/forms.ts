// Form parsing for sign-in and set-password. Supabase Auth has the final say (wrong
// credentials, weak password); these checks only give quick, clear feedback.
import { isEmail, normalizeEmail } from '@/lib/text/email';

export const MIN_PASSWORD_LENGTH = 8;

type Parsed<T> = ({ ok: true } & T) | { ok: false; message: string };

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

export function parseSignIn(form: FormData): Parsed<{ email: string; password: string }> {
  const email = normalizeEmail(field(form, 'email'));
  const password = field(form, 'password');
  if (!isEmail(email) || password === '') return { ok: false, message: 'Enter your email and password.' };
  return { ok: true, email, password };
}

export function parseNewPassword(form: FormData): Parsed<{ password: string }> {
  const password = field(form, 'password');
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password !== field(form, 'confirm')) return { ok: false, message: 'The passwords do not match.' };
  return { ok: true, password };
}
