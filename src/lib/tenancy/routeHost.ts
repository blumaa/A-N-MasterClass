// Host header + path -> route, looking up custom hosts in space_domains. The only async step
// of tenancy; resolveHost and routeFor stay pure.
import type { FindSlug } from './hostLookup';
import { resolveHost } from './resolveHost';
import { routeFor, type Route } from './routeFor';

export async function routeHost(rawHost: string | null, pathname: string, platformHost: string, findSlug: FindSlug): Promise<Route> {
  const resolution = resolveHost(rawHost, platformHost);
  const customSlug = resolution.kind === 'custom' ? await findSlug(resolution.host) : null;
  return routeFor(resolution, pathname, customSlug);
}
