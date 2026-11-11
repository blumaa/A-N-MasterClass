import { describe, expect, it } from 'vitest';
import { parseNewPassword, parseSignIn } from './forms';

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe('parseSignIn', () => {
  it('normalizes the email and keeps the password as typed', () => {
    expect(parseSignIn(form({ email: ' Ana@Example.com ', password: ' pw ' }))).toEqual({
      ok: true,
      email: 'ana@example.com',
      password: ' pw ',
    });
  });

  it('refuses a bad email or an empty password', () => {
    expect(parseSignIn(form({ email: 'nope', password: 'x' })).ok).toBe(false);
    expect(parseSignIn(form({ email: 'a@b.co', password: '' })).ok).toBe(false);
    expect(parseSignIn(new FormData()).ok).toBe(false);
  });
});

describe('parseNewPassword', () => {
  it('accepts a matching password of at least 8 characters', () => {
    expect(parseNewPassword(form({ password: 'abcdefgh', confirm: 'abcdefgh' }))).toEqual({ ok: true, password: 'abcdefgh' });
  });

  it('refuses short or mismatched passwords', () => {
    expect(parseNewPassword(form({ password: 'short', confirm: 'short' }))).toEqual({
      ok: false,
      message: 'Use at least 8 characters.',
    });
    expect(parseNewPassword(form({ password: 'abcdefgh', confirm: 'abcdefgX' }))).toEqual({
      ok: false,
      message: 'The passwords do not match.',
    });
  });
});
