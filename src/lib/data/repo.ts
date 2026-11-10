// Data port. Raw reads/writes, no authorization: the DAL (features/*/api) checks
// capabilities + step access before calling. Supabase adapter adds RLS as second wall.
import type {
  Grant,
  Member,
  Module,
  Page,
  PageVersion,
  PageKind,
  Part,
  Product,
  Profile,
  SiteNav,
  Space,
  SpaceBranding,
  SpaceProfile,
  Step,
} from './types';

export type NewProduct = Pick<Product, 'spaceId' | 'kind' | 'slug' | 'title'>;
export type ProductPatch = Partial<Pick<Product, 'slug' | 'title' | 'subtitle' | 'status' | 'themeOverride'>>;
export type NewModule = Pick<Module, 'programId' | 'title'>;
export type ModulePatch = Partial<
  Pick<Module, 'title' | 'description' | 'status' | 'unlockAfterStepId' | 'releaseAfterDays' | 'releaseAt'>
>;
export type NewStep = Pick<Step, 'moduleId' | 'title'>;
export type StepPatch = Partial<Pick<Step, 'title' | 'description' | 'status'>>;
export type NewPart = Pick<Part, 'stepId' | 'kind'>;
export type PartPatch = Partial<Pick<Part, 'title' | 'text' | 'vimeoId' | 'aspect' | 'filePath'>>;
export type NewGrant = Pick<Grant, 'productId' | 'profileId' | 'source'>;

export type NewPage = Pick<Page, 'spaceId' | 'kind' | 'slug' | 'title'>;
export type PagePatch = Partial<
  Pick<Page, 'slug' | 'title' | 'isHome' | 'legalKind' | 'seoTitle' | 'seoDescription' | 'draft' | 'published' | 'publishedAt'>
>;
export type NewPageVersion = Omit<PageVersion, 'id'>;

export type Direction = 'up' | 'down';

export interface Repo {
  // tenancy
  spaceBySlug(slug: string): Promise<Space | null>;
  profile(id: string): Promise<Profile | null>;
  member(spaceId: string, profileId: string): Promise<Member | null>;
  spaceProfiles(spaceId: string): Promise<SpaceProfile[]>;

  // branding (one row per space; none = defaults)
  branding(spaceId: string): Promise<SpaceBranding | null>;
  /** Upsert on space_id. */
  saveBranding(row: SpaceBranding): Promise<SpaceBranding>;

  // products + tree (ordered by position)
  products(spaceId: string): Promise<Product[]>;
  product(id: string): Promise<Product | null>;
  productBySlug(spaceId: string, slug: string): Promise<Product | null>;
  modules(programId: string): Promise<Module[]>;
  module(id: string): Promise<Module | null>;
  steps(moduleIds: readonly string[]): Promise<Step[]>;
  step(id: string): Promise<Step | null>;
  parts(stepId: string): Promise<Part[]>;
  part(id: string): Promise<Part | null>;

  createProduct(input: NewProduct): Promise<Product>;
  updateProduct(id: string, patch: ProductPatch): Promise<Product>;
  createModule(input: NewModule): Promise<Module>;
  updateModule(id: string, patch: ModulePatch): Promise<Module>;
  deleteModule(id: string): Promise<void>;
  createStep(input: NewStep): Promise<Step>;
  updateStep(id: string, patch: StepPatch): Promise<Step>;
  deleteStep(id: string): Promise<void>;
  createPart(input: NewPart): Promise<Part>;
  updatePart(id: string, patch: PartPatch): Promise<Part>;
  deletePart(id: string): Promise<void>;
  /** Swap with sibling. OWES RPC: reorder_* (atomic). */
  move(table: 'modules' | 'steps' | 'parts', id: string, direction: Direction): Promise<void>;

  // access
  activeGrant(productId: string, profileId: string, now: Date): Promise<Grant | null>;
  grants(spaceId: string, profileId: string, now: Date): Promise<Grant[]>;
  grantsForProduct(productId: string): Promise<Grant[]>;
  createGrant(input: NewGrant): Promise<Grant>;
  revokeGrant(id: string): Promise<void>;

  // progress
  completedStepIds(profileId: string, stepIds: readonly string[]): Promise<Set<string>>;
  setStepComplete(profileId: string, stepId: string, done: boolean): Promise<void>;

  // site (pages ordered by title; versions newest first)
  pages(spaceId: string): Promise<Page[]>;
  page(id: string): Promise<Page | null>;
  pageBySlug(spaceId: string, kind: PageKind, slug: string): Promise<Page | null>;
  createPage(input: NewPage): Promise<Page>;
  /** Sets updatedAt. Unique (space, kind, slug) and one home per space are constraints. */
  updatePage(id: string, patch: PagePatch): Promise<Page>;
  /** Cascades to versions. */
  deletePage(id: string): Promise<void>;
  pageVersions(pageId: string): Promise<PageVersion[]>;
  addPageVersion(input: NewPageVersion): Promise<PageVersion>;
  /** None saved = empty nav. */
  siteNav(spaceId: string): Promise<SiteNav>;
  /** Upsert on space_id. */
  saveSiteNav(nav: SiteNav): Promise<SiteNav>;

  // dev only (fake auth switcher)
  profilesInSpace(spaceId: string): Promise<Profile[]>;
}
