// Domain rows. Mirror supabase/migrations (snake_case there, camelCase here).
import type { Role } from '@/lib/auth/capabilities';
import type { FontId } from '@/lib/fonts/catalog';
import type { PublishStatus } from '@/lib/programs/access';
import type { BrandColors } from '@/tokens/resolveBrand';

export type { PublishStatus, Role };

export type Space = {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'live' | 'archived';
  locale: string;
};

export type Profile = { id: string; email: string; isPlatformAdmin: boolean };

export type SpaceProfile = { spaceId: string; profileId: string; displayName: string };

/** null fields = brand.css defaults. */
export type SpaceBranding = {
  spaceId: string;
  colors: BrandColors | null;
  fontHeading: FontId | null;
  fontBody: FontId | null;
};

export type Member = { spaceId: string; profileId: string; role: Role };

export const PRODUCT_KINDS = ['program', 'community', 'coaching', 'podcast', 'download'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export type Product = {
  id: string;
  spaceId: string;
  kind: ProductKind;
  slug: string;
  title: string;
  subtitle: string | null;
  status: PublishStatus;
  position: number;
  /** Per-program brand colours (plan: per-product override). null = space brand. */
  themeOverride: BrandColors | null;
};

export type Module = {
  id: string;
  programId: string;
  title: string;
  description: string | null;
  position: number;
  status: PublishStatus;
  unlockAfterStepId: string | null;
  releaseAfterDays: number | null;
  releaseAt: Date | null;
};

export type Step = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  position: number;
  status: PublishStatus;
};

export const PART_KINDS = ['video', 'text', 'download', 'image', 'embed'] as const;
export type PartKind = (typeof PART_KINDS)[number];

export type Part = {
  id: string;
  stepId: string;
  kind: PartKind;
  title: string | null;
  position: number;
  /** Plain text for now; TipTap JSON when the rich editor lands. */
  text: string | null;
  vimeoId: string | null;
  aspect: number | null;
  filePath: string | null;
};

export type Grant = {
  id: string;
  productId: string;
  profileId: string;
  source: 'purchase' | 'manual' | 'free';
  status: 'active' | 'revoked';
  grantedAt: Date;
  expiresAt: Date | null;
};

export type StepProgress = { profileId: string; stepId: string; completedAt: Date };
