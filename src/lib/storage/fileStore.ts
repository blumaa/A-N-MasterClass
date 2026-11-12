// Port to a private Supabase Storage bucket: `resources` (Studio files) or `community` (member
// photos and chat attachments). Files are never public: every read is
// a short-lived signed URL handed out after an access check (G18, Kajabi downloads). Uploads go
// straight from the browser to a signed upload URL (Server Action bodies are too small for files).

/**
 * Signed URL lifetime. Short on purpose: the URL is minted per click behind a 302 and never cached
 * (route handlers send no-store), so a leaked link dies within a minute. Podcast apps follow the
 * redirect at once, so they also fit inside it.
 */
export const SIGNED_URL_TTL_S = 60;

/** Bucket `resources` file_size_limit (migration 20261110091000). Supabase Free caps uploads at 50 MB. */
export const RESOURCE_MAX_BYTES = 262_144_000;

/** Private buckets. `community` caps size and types itself (migration 20261112100000). */
export const BUCKETS = ['resources', 'community'] as const;
export type Bucket = (typeof BUCKETS)[number];

export type FileStore = {
  /**
   * Signed GET URL valid for SIGNED_URL_TTL_S. `download` = file name for Content-Disposition
   * (Supabase createSignedUrl `download` option); omitted for inline playback (audio).
   */
  signedUrl(path: string, download?: string): Promise<string>;
  /** Signed upload URL for a new object at `path` (Supabase createSignedUploadUrl; valid 2 h, no upsert). */
  uploadUrl(path: string): Promise<string>;
  /** Deletes objects. Missing paths are not an error. */
  remove(paths: string[]): Promise<void>;
};

const fakeUrl = (prefix: string, path: string) =>
  new URL(`https://files.example.test/${prefix}/${path.split('/').map(encodeURIComponent).join('/')}`);

/** Stand-in for DATA_SOURCE=fake: recognisable URLs, nothing behind them. `removed` = paths deleted. */
export function createFakeFileStore(now: () => Date = () => new Date(), bucket: Bucket = 'resources'): FileStore & { removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    async signedUrl(path, download) {
      const url = fakeUrl(bucket, path);
      url.searchParams.set('expires', String(Math.floor(now().getTime() / 1000) + SIGNED_URL_TTL_S));
      if (download !== undefined) url.searchParams.set('download', download);
      return url.toString();
    },
    async uploadUrl(path) {
      const url = fakeUrl(`upload/${bucket}`, path);
      url.searchParams.set('token', 'fake');
      return url.toString();
    },
    async remove(paths) {
      removed.push(...paths);
    },
  };
}
