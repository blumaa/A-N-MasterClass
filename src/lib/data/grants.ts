// When a grant gives access. SSOT for TS; SQL has_grant() applies the same rule.
import type { Grant } from './types';

export const grantIsActive = (g: Grant, now: Date): boolean =>
  g.status === 'active' && (g.expiresAt === null || g.expiresAt > now);
