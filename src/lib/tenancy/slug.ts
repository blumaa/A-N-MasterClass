// Space slug rules. SSOT for app; DB check constraint mirrors SLUG_PATTERN (phase 1).
import { PLATFORM_LABELS } from './resolveHost';

// One DNS label: lowercase letters, digits, inner hyphens, max 63.
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// Route segment the proxy rewrites platform-host requests under.
export const PLATFORM_SEGMENT = 'platform';

export const RESERVED_SLUGS: readonly string[] = [...PLATFORM_LABELS, PLATFORM_SEGMENT, 'api'];

export const isValidSlug = (slug: string): boolean =>
  SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.includes(slug);
