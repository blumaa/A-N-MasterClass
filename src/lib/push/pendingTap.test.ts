import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PENDING_TAP_CACHE, PENDING_TAP_KEY, PENDING_TAP_TTL_MS, sameOriginPath, takePendingTap } from './pendingTap';

const ORIGIN = window.location.origin;
const NOW = 1_700_000_000_000;

/** Cache Storage stand-in: jsdom has none. Only the calls the module makes. */
function fakeCaches() {
  const store = new Map<string, Map<string, string>>();
  return {
    store,
    api: {
      open: async (name: string) => ({
        match: async (key: string) => {
          const body = store.get(name)?.get(key);
          return body === undefined ? undefined : new Response(body);
        },
        put: async (key: string, res: Response) => {
          const cache = store.get(name) ?? new Map<string, string>();
          cache.set(key, await res.text());
          store.set(name, cache);
        },
        delete: async (key: string) => store.get(name)?.delete(key) ?? false,
      }),
    },
  };
}

let fake: ReturnType<typeof fakeCaches>;
const write = async (body: string) => (await fake.api.open(PENDING_TAP_CACHE)).put(PENDING_TAP_KEY, new Response(body));
const stored = () => fake.store.get(PENDING_TAP_CACHE)?.get(PENDING_TAP_KEY);

beforeEach(() => {
  fake = fakeCaches();
  Object.defineProperty(globalThis, 'caches', { value: fake.api, configurable: true, writable: true });
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'caches');
});

describe('takePendingTap', () => {
  it('returns the path the tapped notification named', async () => {
    await write(JSON.stringify({ url: `${ORIGIN}/community/c/posts/p1?x=1#c9`, ts: NOW }));
    expect(await takePendingTap(NOW)).toBe('/community/c/posts/p1?x=1#c9');
  });

  it('consumes the tap, so a later boot is not moved again', async () => {
    await write(JSON.stringify({ url: `${ORIGIN}/notifications`, ts: NOW }));
    await takePendingTap(NOW);
    expect(stored()).toBeUndefined();
    expect(await takePendingTap(NOW)).toBeNull();
  });

  it('drops a tap older than the ttl', async () => {
    await write(JSON.stringify({ url: `${ORIGIN}/notifications`, ts: NOW }));
    expect(await takePendingTap(NOW + PENDING_TAP_TTL_MS + 1)).toBeNull();
    expect(stored()).toBeUndefined();
  });

  it('refuses a foreign origin or a relative url', async () => {
    await write(JSON.stringify({ url: 'https://evil.test/x', ts: NOW }));
    expect(await takePendingTap(NOW)).toBeNull();
    await write(JSON.stringify({ url: '/relative', ts: NOW }));
    expect(await takePendingTap(NOW)).toBeNull();
  });

  it('is null for a malformed entry, no entry, or no Cache Storage', async () => {
    await write('not json');
    expect(await takePendingTap(NOW)).toBeNull();
    expect(await takePendingTap(NOW)).toBeNull();
    Reflect.deleteProperty(globalThis, 'caches');
    expect(await takePendingTap(NOW)).toBeNull();
  });
});

describe('sameOriginPath', () => {
  it('keeps path, query and hash of an absolute url on this origin only', () => {
    expect(sameOriginPath(`${ORIGIN}/a?b=1#c`)).toBe('/a?b=1#c');
    expect(sameOriginPath('https://evil.test/a')).toBeNull();
    expect(sameOriginPath('/a')).toBeNull();
    expect(sameOriginPath('javascript:alert(1)')).toBeNull();
    expect(sameOriginPath(42)).toBeNull();
  });
});
