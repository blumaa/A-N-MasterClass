// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { routeHost } from './routeHost';

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
