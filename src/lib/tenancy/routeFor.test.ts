// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { routeFor, PLATFORM_SEGMENT } from './routeFor';

describe('routeFor', () => {
  it('platform host rewrites under the platform segment', () => {
    expect(routeFor({ kind: 'platform' }, '/')).toEqual({ rewrite: `/${PLATFORM_SEGMENT}` });
    expect(routeFor({ kind: 'platform' }, '/spaces/new')).toEqual({ rewrite: `/${PLATFORM_SEGMENT}/spaces/new` });
  });

  it('subdomain rewrites under the space slug', () => {
    expect(routeFor({ kind: 'subdomain', slug: 'natasha' }, '/')).toEqual({ rewrite: '/natasha' });
    expect(routeFor({ kind: 'subdomain', slug: 'natasha' }, '/programs/a')).toEqual({ rewrite: '/natasha/programs/a' });
  });

  it('a slug equal to the platform segment is not found', () => {
    expect(routeFor({ kind: 'subdomain', slug: PLATFORM_SEGMENT }, '/')).toEqual({ notFound: true });
  });

  it('a slug that is not a valid slug is not found', () => {
    expect(routeFor({ kind: 'subdomain', slug: 'bad_slug' }, '/')).toEqual({ notFound: true });
  });

  it('custom host resolved to a slug rewrites under that slug', () => {
    expect(routeFor({ kind: 'custom', host: 'x.de' }, '/a', 'natasha')).toEqual({ rewrite: '/natasha/a' });
  });

  it('custom host without a known space is not found', () => {
    expect(routeFor({ kind: 'custom', host: 'x.de' }, '/a', null)).toEqual({ notFound: true });
  });

  it('unknown host is not found', () => {
    expect(routeFor({ kind: 'unknown' }, '/')).toEqual({ notFound: true });
  });
});
