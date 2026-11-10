// In-memory tables for DATA_SOURCE=fake. REPLACED BY: Supabase tables (supabase/migrations).
import type {
  Grant,
  Member,
  Module,
  Page,
  PageVersion,
  Part,
  Product,
  Profile,
  SiteNav,
  Space,
  SpaceBranding,
  SpaceProfile,
  Step,
  StepProgress,
} from '../types';

export type Db = {
  spaces: Space[];
  profiles: Profile[];
  spaceProfiles: SpaceProfile[];
  branding: SpaceBranding[];
  members: Member[];
  products: Product[];
  modules: Module[];
  steps: Step[];
  parts: Part[];
  grants: Grant[];
  stepProgress: StepProgress[];
  pages: Page[];
  pageVersions: PageVersion[];
  siteNav: SiteNav[];
};

export const emptyDb = (): Db => ({
  spaces: [],
  profiles: [],
  spaceProfiles: [],
  branding: [],
  members: [],
  products: [],
  modules: [],
  steps: [],
  parts: [],
  grants: [],
  stepProgress: [],
  pages: [],
  pageVersions: [],
  siteNav: [],
});
