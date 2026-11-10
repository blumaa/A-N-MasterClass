/* Video lives on Vimeo (G9): a media row carries the video id, never a URL. */

export const VIMEO_PLAYER = 'https://player.vimeo.com/video/';

const HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const BARE_ID = /^\d+$/;

// The share link, the unlisted link with its hash, the player link, the manage link.
const PATHS = [/^\/(\d+)(?:\/[0-9a-f]+)?\/?$/i, /^\/video\/(\d+)/, /^\/manage\/videos\/(\d+)/];

/* The video id inside whatever the admin pasted, or null when it is not a Vimeo link. */
export function vimeoIdOf(typed: string): string | null {
  const trimmed = typed.trim();
  if (BARE_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname)) return null;

  for (const path of PATHS) {
    const match = path.exec(url.pathname);
    if (match?.[1]) return match[1];
  }
  return null;
}

/* dnt=1: Vimeo keeps no session or analytics on the reader (privacy). */
export const vimeoPlayerUrl = (id: string): string => `${VIMEO_PLAYER}${id}?dnt=1`;

const OEMBED = 'https://vimeo.com/api/oembed.json';

/* Wide enough for the card's poster; Vimeo scales the thumbnail to it. */
const THUMBNAIL_WIDTH = 1280;

export interface VimeoMeta {
  title: string;
  /** Width ÷ height. */
  aspect: number;
  /** Seconds. */
  duration: number;
  thumbnailUrl: string;
}

/* Vimeo will not hand the video over: private, deleted, or embedding this domain is not allowed. */
export class VimeoRefusal extends Error {
  constructor(public readonly status: number) {
    super(`Vimeo refused the video: ${status}`);
    this.name = 'VimeoRefusal';
  }
}

interface OEmbed {
  title: string;
  width: number;
  height: number;
  duration: number;
  thumbnail_url: string;
}

const oembedUrl = (id: string): string =>
  `${OEMBED}?url=${encodeURIComponent(`https://vimeo.com/${id}`)}&width=${THUMBNAIL_WIDTH}`;

export async function fetchVimeoMeta(id: string): Promise<VimeoMeta> {
  const response = await fetch(oembedUrl(id));
  if (response.status === 403 || response.status === 404) throw new VimeoRefusal(response.status);
  if (!response.ok) throw new Error(`Vimeo answered ${response.status}`);

  const body = (await response.json()) as OEmbed;
  return {
    title: body.title,
    aspect: body.width / body.height,
    duration: body.duration,
    thumbnailUrl: body.thumbnail_url,
  };
}

/* Poster copy (bucket) comes with Storage; not wired yet. */
