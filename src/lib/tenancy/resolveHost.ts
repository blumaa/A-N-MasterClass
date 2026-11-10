// Host header -> tenant kind. Pure. Proxy decides what to do with the result.
// Custom hosts are looked up in `space_domains` by routeHost.

export type HostResolution =
  | { kind: 'platform' }
  | { kind: 'subdomain'; slug: string }
  | { kind: 'custom'; host: string }
  | { kind: 'unknown' };

// Subdomain labels of the platform host that belong to the platform itself.
// SSOT: also the slugs a space may never take.
export const PLATFORM_LABELS = ['www', 'staging'] as const;

const isPlatformLabel = (label: string): boolean =>
  (PLATFORM_LABELS as readonly string[]).includes(label);

export function resolveHost(rawHost: string | null, platformHost: string): HostResolution {
  const host = (rawHost ?? '').trim().toLowerCase().replace(/:\d+$/, '');
  if (host === '') return { kind: 'unknown' };

  const platform = platformHost.toLowerCase();
  if (host === platform) return { kind: 'platform' };

  const suffix = `.${platform}`;
  if (!host.endsWith(suffix)) return { kind: 'custom', host };

  const label = host.slice(0, -suffix.length);
  if (label.includes('.')) return { kind: 'unknown' };
  if (isPlatformLabel(label)) return { kind: 'platform' };
  return { kind: 'subdomain', slug: label };
}
