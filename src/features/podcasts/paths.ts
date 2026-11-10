// Browser paths (host-relative; the proxy adds the space segment). SSOT for podcast links.
export const podcastHref = (product: string): string => `/podcasts/${product}`;
export const episodeAudioHref = (product: string, episode: string): string => `${podcastHref(product)}/episodes/${episode}/audio`;
/** Private feed URL for podcast apps. The token is the only credential. */
export const feedHref = (token: string): string => `/feeds/podcast/${token}`;
export const feedEpisodeHref = (token: string, episode: string): string => `${feedHref(token)}/episodes/${episode}`;
export const studioPodcastsHref = '/studio/podcasts';
