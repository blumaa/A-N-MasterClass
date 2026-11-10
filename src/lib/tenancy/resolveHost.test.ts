// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveHost } from './resolveHost';

const PLATFORM = 'masterclass.test';

describe('resolveHost', () => {
  it('platform apex is the platform', () => {
    expect(resolveHost('masterclass.test', PLATFORM)).toEqual({ kind: 'platform' });
  });

  it('www on the platform is the platform', () => {
    expect(resolveHost('www.masterclass.test', PLATFORM)).toEqual({ kind: 'platform' });
  });

  it('strips the port', () => {
    expect(resolveHost('masterclass.test:3000', PLATFORM)).toEqual({ kind: 'platform' });
  });

  it('is case-insensitive', () => {
    expect(resolveHost('Alexander.MasterClass.test', PLATFORM)).toEqual({ kind: 'subdomain', slug: 'alexander' });
  });

  it('one-label subdomain of the platform is a space slug', () => {
    expect(resolveHost('natasha.masterclass.test', PLATFORM)).toEqual({ kind: 'subdomain', slug: 'natasha' });
  });

  it('staging subdomain is the platform staging host, not a space', () => {
    expect(resolveHost('staging.masterclass.test', PLATFORM)).toEqual({ kind: 'platform' });
  });

  it('nested subdomain of the platform is unknown', () => {
    expect(resolveHost('a.b.masterclass.test', PLATFORM)).toEqual({ kind: 'unknown' });
  });

  it('any other host is a custom domain, looked up later', () => {
    expect(resolveHost('www.natasha-kinbaku.de', PLATFORM)).toEqual({ kind: 'custom', host: 'www.natasha-kinbaku.de' });
  });

  it('a host that only ends with the platform string is custom, not a subdomain', () => {
    expect(resolveHost('evilmasterclass.test', PLATFORM)).toEqual({ kind: 'custom', host: 'evilmasterclass.test' });
  });

  it('empty host is unknown', () => {
    expect(resolveHost('', PLATFORM)).toEqual({ kind: 'unknown' });
    expect(resolveHost(null, PLATFORM)).toEqual({ kind: 'unknown' });
  });
});
