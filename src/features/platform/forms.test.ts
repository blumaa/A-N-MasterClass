import { describe, expect, it } from 'vitest';
import { parsePlatformCommand } from './forms';

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

const NEW_SPACE = { op: 'create', name: 'Old-Time Fiddle', ownerEmail: ' Ana@Example.com ', ownerName: 'Ana', isTest: 'true' };

describe('parsePlatformCommand', () => {
  it('reads a new space, deriving the slug from the name and normalizing the email', () => {
    expect(parsePlatformCommand(form(NEW_SPACE))).toEqual({
      ok: true,
      command: { op: 'create', name: 'Old-Time Fiddle', slug: 'old-time-fiddle', ownerEmail: 'ana@example.com', ownerName: 'Ana', isTest: true },
    });
  });

  it('keeps a typed slug', () => {
    const parsed = parsePlatformCommand(form({ ...NEW_SPACE, slug: 'fiddle' }));
    expect(parsed.ok && parsed.command).toMatchObject({ slug: 'fiddle' });
  });

  it('refuses a bad slug, a bad email or a missing owner name', () => {
    expect(parsePlatformCommand(form({ ...NEW_SPACE, slug: 'Not ok' }))).toEqual({
      ok: false,
      message: 'Use lowercase letters, digits and hyphens for the address (not www, staging, platform or api).',
    });
    expect(parsePlatformCommand(form({ ...NEW_SPACE, slug: 'platform' })).ok).toBe(false);
    expect(parsePlatformCommand(form({ ...NEW_SPACE, ownerEmail: 'nope' }))).toEqual({ ok: false, message: 'Enter the owner’s email.' });
    expect(parsePlatformCommand(form({ ...NEW_SPACE, ownerName: '' })).ok).toBe(false);
  });

  it('reads a status change', () => {
    expect(parsePlatformCommand(form({ op: 'setStatus', slug: 'fiddle', status: 'live' }))).toEqual({
      ok: true,
      command: { op: 'setStatus', slug: 'fiddle', status: 'live' },
    });
    expect(parsePlatformCommand(form({ op: 'setStatus', slug: 'fiddle', status: 'gone' })).ok).toBe(false);
  });

  it('reads a domain as a lowercase bare host with a dot', () => {
    expect(parsePlatformCommand(form({ op: 'addDomain', slug: 'fiddle', host: ' Fiddle.Example.COM ', isPrimary: 'true' }))).toEqual({
      ok: true,
      command: { op: 'addDomain', slug: 'fiddle', host: 'fiddle.example.com', isPrimary: true },
    });
    for (const host of ['https://x.com', 'localhost', 'x.com/path', 'x.com:3000']) {
      expect(parsePlatformCommand(form({ op: 'addDomain', slug: 'fiddle', host, isPrimary: 'false' }))).toEqual({
        ok: false,
        message: 'Enter a domain like courses.example.com (no https:// or path).',
      });
    }
  });

  it('reads domain removal and a new owner claim link', () => {
    expect(parsePlatformCommand(form({ op: 'removeDomain', slug: 'fiddle', host: 'A.com' }))).toEqual({
      ok: true,
      command: { op: 'removeDomain', slug: 'fiddle', host: 'a.com' },
    });
    expect(parsePlatformCommand(form({ op: 'ownerClaim', slug: 'fiddle' }))).toEqual({
      ok: true,
      command: { op: 'ownerClaim', slug: 'fiddle' },
    });
  });
});
