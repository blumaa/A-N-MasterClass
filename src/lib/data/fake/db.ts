// In-memory tables for DATA_SOURCE=fake. REPLACED BY: Supabase tables (supabase/migrations).
import type {
  Channel,
  ClaimToken,
  Comment,
  CommunityStaff,
  Contact,
  Grant,
  Member,
  Module,
  Notification,
  Offer,
  OfferProduct,
  Order,
  Page,
  PageVersion,
  Part,
  PaymentCredentials,
  PaymentEnv,
  Post,
  Product,
  Profile,
  Reaction,
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
  channels: Channel[];
  communityStaff: CommunityStaff[];
  posts: Post[];
  comments: Comment[];
  reactions: Reaction[];
  notifications: Notification[];
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
  channels: [],
  communityStaff: [],
  posts: [],
  comments: [],
  reactions: [],
  notifications: [],
});
