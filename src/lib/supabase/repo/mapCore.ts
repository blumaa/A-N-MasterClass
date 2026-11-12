// Row (snake_case, ISO strings, jsonb) -> domain type (camelCase, Date). Core tables only.
// jsonb shapes are guarded by SQL checks (is_brand_colors), so the casts below trust the DB.
import type { FontId } from '@/lib/fonts/catalog';
import type {
  Grant,
  Member,
  Module,
  Part,
  Product,
  Profile,
  Space,
  SpaceDomain,
  SpaceBranding,
  SpaceProfile,
  Step,
} from '@/lib/data/types';
import type { BrandColors } from '@/tokens/resolveBrand';
import { toDate, toDateOrNull, type Row } from './context';

export const toSpace = (r: Row<'spaces'>): Space => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  status: r.status as Space['status'],
  locale: r.locale,
  isTest: r.is_test,
});

export const toSpaceDomain = (r: Row<'space_domains'>): SpaceDomain => ({
  host: r.host,
  spaceId: r.space_id,
  isPrimary: r.is_primary,
});

export const toProfile = (r: Row<'profiles'>): Profile => ({
  id: r.id,
  email: r.email,
  isPlatformAdmin: r.is_platform_admin,
});

export const toSpaceProfile = (r: Row<'space_profiles'>): SpaceProfile => ({
  spaceId: r.space_id,
  profileId: r.profile_id,
  displayName: r.display_name,
});

export const toMember = (r: Row<'space_members'>): Member => ({
  spaceId: r.space_id,
  profileId: r.profile_id,
  role: r.role as Member['role'],
});

export const toBranding = (r: Row<'space_branding'>): SpaceBranding => ({
  spaceId: r.space_id,
  colors: r.colors as BrandColors | null,
  fontHeading: r.font_heading as FontId | null,
  fontBody: r.font_body as FontId | null,
});

export const toProduct = (r: Row<'products'>): Product => ({
  id: r.id,
  spaceId: r.space_id,
  kind: r.kind as Product['kind'],
  slug: r.slug,
  title: r.title,
  subtitle: r.subtitle,
  status: r.status as Product['status'],
  position: r.position,
  themeOverride: r.theme_override as BrandColors | null,
  certificates: r.certificates,
  coverPath: r.cover_path,
});

export const toModule = (r: Row<'modules'>): Module => ({
  id: r.id,
  programId: r.program_id,
  title: r.title,
  description: r.description,
  position: r.position,
  status: r.status as Module['status'],
  unlockAfterStepId: r.unlock_after_step_id,
  unlockQuizPartId: r.unlock_quiz_part_id,
  releaseAfterDays: r.release_after_days,
  releaseAt: toDateOrNull(r.release_at),
});

export const toStep = (r: Row<'steps'>): Step => ({
  id: r.id,
  moduleId: r.module_id,
  title: r.title,
  description: r.description,
  position: r.position,
  status: r.status as Step['status'],
});

/** Part.text lives in parts.body as a jsonb string (TipTap JSON later). */
export const toPart = (r: Row<'parts'>): Part => ({
  id: r.id,
  stepId: r.step_id,
  kind: r.kind as Part['kind'],
  title: r.title,
  position: r.position,
  text: typeof r.body === 'string' ? r.body : null,
  vimeoId: r.vimeo_id,
  aspect: r.aspect,
  filePath: r.file_path,
  fileSize: r.file_size,
  passPercent: r.pass_percent,
});

export const toGrant = (r: Row<'grants'>): Grant => ({
  id: r.id,
  productId: r.product_id,
  profileId: r.profile_id,
  source: r.source as Grant['source'],
  status: r.status as Grant['status'],
  grantedAt: toDate(r.granted_at),
  expiresAt: toDateOrNull(r.expires_at),
  orderId: r.order_id,
  subscriptionId: r.subscription_id,
  accessGroupId: r.access_group_id,
});
