// Role -> capability matrix (G15). SSOT: SQL seed in supabase/migrations must match (capabilities.sql.test.ts).
export const ROLES = ['owner', 'admin', 'assistant', 'support'] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  'products.edit',
  'site.edit',
  'branding.manage',
  'offers.manage',
  'customers.manage',
  'community.moderate',
  'comments.moderate',
  'analytics.view',
  'settings.manage',
  'staff.manage',
  'payments.manage',
  'api_keys.manage',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const OWNER_ONLY: readonly Capability[] = ['payments.manage', 'api_keys.manage'];

export const MATRIX: Readonly<Record<Role, readonly Capability[]>> = {
  owner: CAPABILITIES,
  admin: CAPABILITIES.filter((cap) => !OWNER_ONLY.includes(cap)),
  assistant: ['products.edit', 'site.edit', 'community.moderate', 'comments.moderate'],
  support: ['customers.manage', 'comments.moderate'],
};

export function capabilitiesOf(role: Role): Capability[] {
  return CAPABILITIES.filter((cap) => MATRIX[role].includes(cap));
}

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role].includes(cap);
}

/** Roles that reach every community without a per-community tick (G15). Mirrored in SQL reaches_community(). */
export const ALWAYS_REACH: readonly Role[] = ['owner', 'admin'];
