import { describe, expect, it, vi } from 'vitest';
import { createHostLookup } from './hostLookup';

describe('createHostLookup', () => {
  it('caches hits and misses for the TTL, then asks again', async () => {
    let now = 0;
    const find = vi.fn(async (host: string) => (host === 'a.example' ? 'alexander' : null));
    const lookup = createHostLookup(find, { ttlMs: 1000, now: () => now });

    expect(await lookup('a.example')).toBe('alexander');
    expect(await lookup('a.example')).toBe('alexander');
    expect(await lookup('b.example')).toBeNull();
    expect(await lookup('b.example')).toBeNull();
    expect(find).toHaveBeenCalledTimes(2);

    now = 1001;
    await lookup('a.example');
    expect(find).toHaveBeenCalledTimes(3);
  });

  it('does not cache a failed lookup', async () => {
    const find = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce('alexander');
    const lookup = createHostLookup(find, { ttlMs: 1000, now: () => 0 });
    await expect(lookup('a.example')).rejects.toThrow('db down');
    expect(await lookup('a.example')).toBe('alexander');
  });

  it('evicts the oldest entry past maxEntries', async () => {
    const find = vi.fn(async () => null);
    const lookup = createHostLookup(find, { ttlMs: 1000, now: () => 0, maxEntries: 2 });
    await lookup('1.example');
    await lookup('2.example');
    await lookup('3.example');
    await lookup('2.example');
    expect(find).toHaveBeenCalledTimes(3);
    await lookup('1.example');
    expect(find).toHaveBeenCalledTimes(4);
  });
});
