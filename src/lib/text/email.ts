// Email address checks for forms. Deliberately loose (one @, a dot in the domain, no spaces):
// the real check is the email we send.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** RFC 5321 path limit. */
const MAX_LENGTH = 254;

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const isEmail = (value: string): boolean => value.length <= MAX_LENGTH && EMAIL.test(value);
