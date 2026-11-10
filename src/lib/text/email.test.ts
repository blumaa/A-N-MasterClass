import { describe, expect, it } from 'vitest';
import { isEmail, normalizeEmail } from './email';

describe('email', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
  });

  it('accepts plain addresses, refuses junk and overlong ones', () => {
    expect(isEmail('ana@example.com')).toBe(true);
    expect(isEmail('ana@example')).toBe(false);
    expect(isEmail('ana example@x.com')).toBe(false);
    expect(isEmail('a@b@c.com')).toBe(false);
    expect(isEmail(`${'a'.repeat(250)}@x.com`)).toBe(false);
  });
});
