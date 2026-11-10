// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './csp';

const directive = (csp: string, name: string): string[] =>
  csp.split(';').map((d) => d.trim().split(/\s+/)).find(([n]) => n === name)?.slice(1) ?? [];

describe('contentSecurityPolicy', () => {
  const prod = contentSecurityPolicy({ dev: false });

  it('defaults to self and locks down objects, base, framing', () => {
    expect(directive(prod, 'default-src')).toEqual(["'self'"]);
    expect(directive(prod, 'object-src')).toEqual(["'none'"]);
    expect(directive(prod, 'base-uri')).toEqual(["'self'"]);
    expect(directive(prod, 'frame-ancestors')).toEqual(["'none'"]);
  });

  it('allows the PayPal JS SDK hosts PayPal documents', () => {
    for (const name of ['script-src', 'style-src', 'connect-src', 'frame-src', 'child-src', 'img-src']) {
      expect(directive(prod, name)).toEqual(expect.arrayContaining(['*.paypal.com', '*.paypalobjects.com', '*.venmo.com']));
    }
  });

  it('allows the Vimeo player frame only as a frame', () => {
    expect(directive(prod, 'frame-src')).toContain('https://player.vimeo.com');
    expect(directive(prod, 'script-src')).not.toContain('https://player.vimeo.com');
  });

  it('adds unsafe-eval in dev only (React dev error stacks)', () => {
    expect(directive(prod, 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ dev: true }), 'script-src')).toContain("'unsafe-eval'");
  });

  it('adds extra connect/img origins (Supabase project) when given', () => {
    const csp = contentSecurityPolicy({ dev: false, dataOrigin: 'https://abc.supabase.co' });
    expect(directive(csp, 'connect-src')).toEqual(expect.arrayContaining(['https://abc.supabase.co', 'wss://abc.supabase.co']));
    expect(directive(csp, 'img-src')).toContain('https://abc.supabase.co');
  });
});

describe('securityHeaders', () => {
  it('sends CSP plus the COOP PayPal asks for popups', () => {
    const headers = Object.fromEntries(securityHeaders({ dev: false }).map((h) => [h.key, h.value]));
    expect(headers['Content-Security-Policy']).toBe(contentSecurityPolicy({ dev: false }));
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
  });
});
