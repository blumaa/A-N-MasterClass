import { describe, expect, it } from 'vitest';
import { requestHost } from './requestHost';

const h = (init: Record<string, string>) => new Headers(init);

describe('requestHost', () => {
  it('prefers x-forwarded-host, which survives Next re-fetching a server-action redirect on localhost', () => {
    expect(requestHost(h({ host: 'localhost:3000', 'x-forwarded-host': 'alexander.localhost:3000' }))).toBe('alexander.localhost:3000');
  });

  it('takes the first entry when a proxy chain lists several hosts', () => {
    expect(requestHost(h({ 'x-forwarded-host': 'alexander-ma.com, edge.internal' }))).toBe('alexander-ma.com');
  });

  it('falls back to host', () => {
    expect(requestHost(h({ host: 'natasha.localhost:3000' }))).toBe('natasha.localhost:3000');
  });

  it('returns null when neither header is present', () => {
    expect(requestHost(h({}))).toBeNull();
  });
});
