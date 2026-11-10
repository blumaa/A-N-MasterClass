// Port to the private `resources` bucket (Supabase Storage). Files are never public: every read is
// a short-lived signed URL handed out after an access check (G18, Kajabi downloads).

/**
 * Signed URL lifetime. Short on purpose: the URL is minted per click behind a 302 and never cached
 * (route handlers send no-store), so a leaked link dies within a minute. Podcast apps follow the
 * redirect at once, so they also fit inside it.
 */
export const SIGNED_URL_TTL_S = 60;

export type FileStore = {
  /**
   * Signed GET URL valid for SIGNED_URL_TTL_S. `download` = file name for Content-Disposition
   * (Supabase createSignedUrl `download` option); omitted for inline playback (audio).
   */
  signedUrl(path: string, download?: string): Promise<string>;
};

/** Stand-in for DATA_SOURCE=fake: a recognisable URL, nothing behind it. */
export function createFakeFileStore(now: () => Date = () => new Date()): FileStore {
  return {
    async signedUrl(path, download) {
      const url = new URL(`https://files.example.test/resources/${path.split('/').map(encodeURIComponent).join('/')}`);
      url.searchParams.set('expires', String(Math.floor(now().getTime() / 1000) + SIGNED_URL_TTL_S));
      if (download !== undefined) url.searchParams.set('download', download);
      return url.toString();
    },
  };
}
