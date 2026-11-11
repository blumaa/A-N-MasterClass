// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { routeHost, spaceSlugForHost } from './routeHost';

const find = vi.fn(async (host: string) => (host === 'alexander.example' ? 'alexander' : null));

describe('routeHost', () => {
  it('looks up only custom hosts', async () => {
    find.mockClear();
    expect(await routeHost('natasha.masterclass.test', '/a', 'masterclass.test', find)).toEqual({ rewrite: '/natasha/a' });
    expect(find).not.toHaveBeenCalled();
  });

  it('rewrites a known custom host under its space; port and case ignored', async () => {
    expect(await routeHost('Alexander.Example:443', '/', 'masterclass.test', find)).toEqual({ rewrite: '/alexander' });
    expect(find).toHaveBeenCalledWith('alexander.example');
  });

  it('unknown custom host is not found', async () => {
    expect(await routeHost('nobody.example', '/', 'masterclass.test', find)).toEqual({ notFound: true });
  });
});

describe('spaceSlugForHost', () => {
  it('subdomain slug without a lookup', async () => {
    find.mockClear();
    expect(await spaceSlugForHost('natasha.masterclass.test', 'masterclass.test', find)).toBe('natasha');
    expect(find).not.toHaveBeenCalled();
  });

  it('custom host via the lookup; unknown host is null', async () => {
    expect(await spaceSlugForHost('alexander.example', 'masterclass.test', find)).toBe('alexander');
    expect(await spaceSlugForHost('nobody.example', 'masterclass.test', find)).toBeNull();
  });

  it('platform host and empty host are null', async () => {
    expect(await spaceSlugForHost('masterclass.test', 'masterclass.test', find)).toBeNull();
    expect(await spaceSlugForHost(null, 'masterclass.test', find)).toBeNull();
  });
});
