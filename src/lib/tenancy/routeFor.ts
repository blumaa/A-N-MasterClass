// Host resolution + path -> where the proxy sends the request. Pure.
import type { HostResolution } from './resolveHost';
import { isValidSlug, PLATFORM_SEGMENT } from './slug';

export { PLATFORM_SEGMENT };

export type Route = { rewrite: string } | { notFound: true };

const under = (segment: string, pathname: string): string =>
  pathname === '/' ? `/${segment}` : `/${segment}${pathname}`;

const space = (slug: string | null | undefined, pathname: string): Route =>
  slug && isValidSlug(slug) ? { rewrite: under(slug, pathname) } : { notFound: true };

// `customSlug`: slug found in `space_domains` for a custom host (null = none).
export function routeFor(resolution: HostResolution, pathname: string, customSlug?: string | null): Route {
  switch (resolution.kind) {
    case 'platform':
      return { rewrite: under(PLATFORM_SEGMENT, pathname) };
    case 'subdomain':
      return space(resolution.slug, pathname);
    case 'custom':
      return space(customSlug, pathname);
    case 'unknown':
      return { notFound: true };
  }
}
