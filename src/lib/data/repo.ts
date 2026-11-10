// Data port. Raw reads/writes, no authorization: the DAL (features/*/api) checks
// capabilities + step access before calling. Supabase adapter adds RLS as second wall.
import type {
  Channel,
  ClaimToken,
  Comment,
  CommentTarget,
  Contact,
  Grant,
  Member,
  Module,
  Notification,
  Offer,
  Order,
  OrderProvider,
  Page,
  PageVersion,
  PageKind,
  Part,
  PaymentCredentials,
  PaymentEnv,
  Post,
  Product,
  Profile,
  Reaction,
  ReactionTarget,
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
export type NewGrant = Pick<Grant, 'productId' | 'profileId' | 'source'> & { orderId?: string | null };

export type NewPage = Pick<Page, 'spaceId' | 'kind' | 'slug' | 'title'>;
export type PagePatch = Partial<
  Pick<Page, 'slug' | 'title' | 'isHome' | 'legalKind' | 'seoTitle' | 'seoDescription' | 'draft' | 'published' | 'publishedAt'>
>;
export type NewPageVersion = Omit<PageVersion, 'id'>;

export type NewOffer = Pick<Offer, 'spaceId' | 'slug' | 'title' | 'priceCents' | 'currency'>;
export type OfferPatch = Partial<Pick<Offer, 'slug' | 'title' | 'description' | 'priceCents' | 'currency' | 'status'>>;
export type NewOrder = Omit<Order, 'id' | 'profileId' | 'captureId' | 'status' | 'paidAt'>;
export type OrderPatch = Partial<Pick<Order, 'profileId' | 'captureId' | 'status' | 'paidAt'>>;
/** consent null = leave marketing consent as it is (never withdrawn by a purchase). */
export type ContactUpsert = {
  spaceId: string;
  email: string;
  profileId: string | null;
  consent: { source: string; at: Date } | null;
};

export type NewChannel = Pick<Channel, 'communityId' | 'title' | 'visibility'>;
export type ChannelPatch = Partial<Pick<Channel, 'title' | 'visibility'>>;
export type NewPost = Pick<Post, 'channelId' | 'authorId' | 'body' | 'createdAt'>;
export type PostPatch = Partial<Pick<Post, 'pinned' | 'hiddenAt'>>;
export type NewComment = Pick<Comment, 'spaceId' | 'targetType' | 'targetId' | 'parentId' | 'authorId' | 'body' | 'createdAt'>;
export type CommentPatch = Partial<Pick<Comment, 'hiddenAt'>>;
export type NewNotification = Omit<Notification, 'id' | 'readAt'>;

export type Direction = 'up' | 'down';
export type Reorderable = 'modules' | 'steps' | 'parts' | 'channels';

export interface Repo {
  // tenancy
  spaceBySlug(slug: string): Promise<Space | null>;
  /** Slug of the space a custom host is attached to (space_domains), else null. Host compared lowercased. */
  spaceSlugByHost(host: string): Promise<string | null>;
  profile(id: string): Promise<Profile | null>;
  member(spaceId: string, profileId: string): Promise<Member | null>;
  /** Staff of a space. */
  members(spaceId: string): Promise<Member[]>;
  spaceProfiles(spaceId: string): Promise<SpaceProfile[]>;
  /** Email compared lowercased (citext in SQL). */
  profileByEmail(email: string): Promise<Profile | null>;
  /** OWES: Supabase auth.admin.createUser (profile row follows by trigger). */
  createProfile(email: string): Promise<Profile>;
  /** Insert if missing; keeps an existing display name. */
  ensureSpaceProfile(row: SpaceProfile): Promise<void>;

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
  move(table: Reorderable, id: string, direction: Direction): Promise<void>;

  // access
  activeGrant(productId: string, profileId: string, now: Date): Promise<Grant | null>;
  grants(spaceId: string, profileId: string, now: Date): Promise<Grant[]>;
  grantsForProduct(productId: string): Promise<Grant[]>;
  grantsForOrder(orderId: string): Promise<Grant[]>;
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

  // commerce: offers (ordered by title)
  offers(spaceId: string): Promise<Offer[]>;
  offer(id: string): Promise<Offer | null>;
  offerBySlug(spaceId: string, slug: string): Promise<Offer | null>;
  createOffer(input: NewOffer): Promise<Offer>;
  updateOffer(id: string, patch: OfferPatch): Promise<Offer>;
  /** Refused (constraint) once the offer has orders: unpublish instead. */
  deleteOffer(id: string): Promise<void>;
  offerProductIds(offerId: string): Promise<string[]>;
  /** Replaces the set. Products must be in the offer's space. */
  setOfferProducts(offerId: string, productIds: readonly string[]): Promise<void>;

  // commerce: orders (newest first)
  orders(spaceId: string): Promise<Order[]>;
  order(id: string): Promise<Order | null>;
  orderByProviderId(provider: OrderProvider, providerOrderId: string): Promise<Order | null>;
  orderByCaptureId(provider: OrderProvider, captureId: string): Promise<Order | null>;
  createOrder(input: NewOrder): Promise<Order>;
  /** Unique (provider, capture_id) is a constraint. */
  updateOrder(id: string, patch: OrderPatch): Promise<Order>;

  // commerce: PayPal credentials (G28). Secret apart: Vault in SQL, never sent to the browser.
  paymentCredentials(spaceId: string, env: PaymentEnv): Promise<PaymentCredentials | null>;
  paymentSecret(spaceId: string, env: PaymentEnv): Promise<string | null>;
  /** Upsert on (space, env). secret null = keep the stored one. */
  savePaymentCredentials(row: PaymentCredentials, secret: string | null): Promise<void>;

  // commerce: contacts (G16, ordered by email) + claim links (G4)
  contacts(spaceId: string): Promise<Contact[]>;
  upsertContact(input: ContactUpsert): Promise<Contact>;
  createClaimToken(row: ClaimToken): Promise<void>;
  /** Marks a valid (unused, unexpired, same space) token used and returns it; else null. Atomic in SQL. */
  consumeClaimToken(spaceId: string, tokenHash: string, now: Date): Promise<ClaimToken | null>;

  // community (G12): channels ordered by position
  channels(communityId: string): Promise<Channel[]>;
  channel(id: string): Promise<Channel | null>;
  /** Community must be a product of kind 'community'. */
  createChannel(input: NewChannel): Promise<Channel>;
  updateChannel(id: string, patch: ChannelPatch): Promise<Channel>;
  /** Cascades to posts, their comments and reactions. */
  deleteChannel(id: string): Promise<void>;
  /** Profile ids of assistant/support staff ticked for the community (space_member_communities). */
  communityStaff(communityId: string): Promise<string[]>;
  /** Profile must be staff of the community's space. */
  setCommunityStaff(communityId: string, profileId: string, on: boolean): Promise<void>;

  /** Pinned first, then newest first. */
  posts(channelId: string): Promise<Post[]>;
  post(id: string): Promise<Post | null>;
  /** Body 1..10000 chars (constraint). */
  createPost(input: NewPost): Promise<Post>;
  updatePost(id: string, patch: PostPatch): Promise<Post>;
  /** Cascades to its comments, reactions and notifications. */
  deletePost(id: string): Promise<void>;

  /** Oldest first, for every target id given. */
  comments(targetType: CommentTarget, targetIds: readonly string[]): Promise<Comment[]>;
  comment(id: string): Promise<Comment | null>;
  /** Body 1..5000 chars. Parent must be a top-level comment on the same target (constraint). */
  createComment(input: NewComment): Promise<Comment>;
  updateComment(id: string, patch: CommentPatch): Promise<Comment>;
  /** Cascades to replies and reactions. */
  deleteComment(id: string): Promise<void>;

  reactions(targetType: ReactionTarget, targetIds: readonly string[]): Promise<Reaction[]>;
  /** on = insert if missing; off = delete. Unique (target, profile, emoji). */
  setReaction(row: Reaction, on: boolean): Promise<void>;

  /** Newest first, at most `limit`. */
  notifications(spaceId: string, recipientId: string, limit: number): Promise<Notification[]>;
  unreadNotificationCount(spaceId: string, recipientId: string): Promise<number>;
  addNotifications(rows: readonly NewNotification[]): Promise<void>;
  markNotificationsRead(spaceId: string, recipientId: string, now: Date): Promise<void>;

  // dev only (fake auth switcher)
  profilesInSpace(spaceId: string): Promise<Profile[]>;
}
