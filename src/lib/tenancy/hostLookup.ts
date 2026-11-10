// Custom host -> space slug with a small in-process TTL cache, so the proxy does not hit
// space_domains on every request. Misses are cached too (unknown hosts are the common bot case);
// failures are not, so a DB blip does not pin a 404.
export type FindSlug = (host: string) => Promise<string | null>;

export type HostLookupOptions = {
  ttlMs: number;
  now?: () => number;
  /** Oldest entry is evicted past this size. */
  maxEntries?: number;
};

export function createHostLookup(find: FindSlug, { ttlMs, now = Date.now, maxEntries = 1000 }: HostLookupOptions): FindSlug {
  const cache = new Map<string, { slug: string | null; expires: number }>();

  return async (host) => {
    const hit = cache.get(host);
    if (hit && hit.expires > now()) return hit.slug;
    cache.delete(host);

    const slug = await find(host);
    if (cache.size >= maxEntries) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(host, { slug, expires: now() + ttlMs });
    return slug;
  };
}
