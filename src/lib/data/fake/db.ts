// In-memory tables for DATA_SOURCE=fake. REPLACED BY: Supabase tables (supabase/migrations).
import type {
  ClaimToken,
  Contact,
  Grant,
  Member,
  Module,
  Offer,
  OfferProduct,
  Order,
  Page,
  PageVersion,
  Part,
  PaymentCredentials,
  PaymentEnv,
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
  offers: Offer[];
  offerProducts: OfferProduct[];
  orders: Order[];
  paymentCredentials: PaymentCredentials[];
  /** Stands in for Supabase Vault. */
  paymentSecrets: { spaceId: string; env: PaymentEnv; secret: string }[];
  contacts: Contact[];
  claimTokens: ClaimToken[];
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
  offers: [],
  offerProducts: [],
  orders: [],
  paymentCredentials: [],
  paymentSecrets: [],
  contacts: [],
  claimTokens: [],
});
