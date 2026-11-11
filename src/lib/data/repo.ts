// Data port. Raw reads/writes, no authorization: the DAL (features/*/api) checks
// capabilities + step access before calling. Supabase adapter adds RLS as second wall.
import type {
  AccessGroup,
  AvailabilityOverride,
  AvailabilityRule,
  CalendarConnection,
  CoachingProgram,
  CoachingSession,
  CoachSettings,
  SessionNote,
  Challenge,
  ChallengeEntry,
  GroupFeature,
  Meetup,
  MeetupRsvp,
  PointTotal,
  Block,
  Channel,
  CommunitySettings,
  DmRead,
  DmThread,
  Message,
  OfferItem,
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
  SpaceDomain,
  SpaceProfile,
  Step,
  Episode,
  PodcastFeed,
  PodcastSettings,
  ProductFile,
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
export type NewGrant = Pick<Grant, 'productId' | 'profileId' | 'source'> & {
  orderId?: string | null;
  accessGroupId?: string | null;
};

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

export type NewAccessGroup = Pick<AccessGroup, 'communityId' | 'title'> & { isDefault?: boolean };
export type AccessGroupPatch = Partial<Pick<AccessGroup, 'title' | GroupFeature>>;
/** Fields left out stay as stored; pointValues merge per reason. */
export type CommunitySettingsPatch = Partial<Omit<CommunitySettings, 'communityId'>>;
export type NewChallenge = Omit<Challenge, 'id'>;
export type ChallengePatch = Partial<Pick<Challenge, 'title' | 'description' | 'prize' | 'startsAt' | 'endsAt' | 'showBeforeStart'>>;
export type NewMeetup = Omit<Meetup, 'id' | 'replayVimeoId'>;
export type MeetupPatch = Partial<
  Pick<Meetup, 'channelId' | 'title' | 'description' | 'location' | 'timeZone' | 'startsAt' | 'endsAt' | 'replayVimeoId'>
>;
/** Kind and group are fixed once created: posts or messages and private members depend on them. */
export type NewChannel = Pick<Channel, 'communityId' | 'accessGroupId' | 'title' | 'kind' | 'privacy' | 'readOnly'>;
export type ChannelPatch = Partial<Pick<Channel, 'title' | 'privacy' | 'readOnly'>>;
export type NewMessage = Pick<Message, 'channelId' | 'threadId' | 'authorId' | 'body' | 'createdAt'>;
export type MessageWhere = { channelId: string } | { threadId: string };
export type NewPost = Pick<Post, 'channelId' | 'authorId' | 'body' | 'createdAt'>;
export type PostPatch = Partial<Pick<Post, 'pinned' | 'hiddenAt'>>;
export type NewComment = Pick<Comment, 'spaceId' | 'targetType' | 'targetId' | 'parentId' | 'authorId' | 'body' | 'createdAt'>;
export type CommentPatch = Partial<Pick<Comment, 'hiddenAt'>>;
export type NewNotification = Omit<Notification, 'id' | 'readAt'>;

export type NewAvailabilityRule = Omit<AvailabilityRule, 'id'>;
export type NewAvailabilityOverride = Omit<AvailabilityOverride, 'id'>;
export type NewEpisode = Omit<Episode, 'id'>;
export type EpisodePatch = Partial<Omit<Episode, 'id' | 'productId' | 'createdAt'>>;
export type NewProductFile = Omit<ProductFile, 'id'>;
export type NewCoachingSession = Omit<CoachingSession, 'id' | 'status' | 'googleEventId' | 'cancelledAt'>;
export type CoachingSessionPatch = Partial<
  Pick<CoachingSession, 'title' | 'startsAt' | 'endsAt' | 'location' | 'agenda' | 'status' | 'cancelledAt' | 'googleEventId'>
>;
/** Sessions of one space, optionally narrowed to a product and/or a client. */
export type SessionWhere = { spaceId: string; productId?: string; clientId?: string };

export type NewSpace = { slug: string; name: string; isTest: boolean };
export type SpacePatch = Partial<Pick<Space, 'name' | 'status'>>;

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

  // platform admin (G1): spaces, owners, domains
  /** Every space, ordered by name. */
  spaces(): Promise<Space[]>;
  /** New space starts as draft with the default locale. */
  createSpace(input: NewSpace): Promise<Space>;
  updateSpace(id: string, patch: SpacePatch): Promise<Space>;
  /** Insert a staff row; ConstraintError when the profile is already staff of the space. */
  addMember(row: Member): Promise<void>;
  spaceDomains(spaceId: string): Promise<SpaceDomain[]>;
  /** Host stored lowercased; ConstraintError when taken or a second primary. */
  addSpaceDomain(row: SpaceDomain): Promise<void>;
  removeSpaceDomain(host: string): Promise<void>;

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
  /**
   * One active grant per (product, profile, access group) is a constraint. An access group must
   * belong to the product.
   */
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
  offerItems(offerId: string): Promise<OfferItem[]>;
  /**
   * Replaces the set (one row per product). Products must be in the offer's space; an access group
   * must belong to its product (community products only).
   */
  setOfferItems(offerId: string, items: readonly OfferItem[]): Promise<void>;

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

  // community (G12): access groups, default first then by title
  accessGroups(communityId: string): Promise<AccessGroup[]>;
  accessGroup(id: string): Promise<AccessGroup | null>;
  /** Community must be a product of kind 'community'; at most one default group per community. */
  createAccessGroup(input: NewAccessGroup): Promise<AccessGroup>;
  updateAccessGroup(id: string, patch: AccessGroupPatch): Promise<AccessGroup>;
  /** Refused for the default group and for a group used by channels, grants or offers. */
  deleteAccessGroup(id: string): Promise<void>;

  // community: channels ordered by position
  channels(communityId: string): Promise<Channel[]>;
  channel(id: string): Promise<Channel | null>;
  /** Community must be a product of kind 'community'; the access group must be one of its groups. */
  createChannel(input: NewChannel): Promise<Channel>;
  updateChannel(id: string, patch: ChannelPatch): Promise<Channel>;
  /** Cascades to posts (with comments and reactions), messages and channel members. */
  deleteChannel(id: string): Promise<void>;
  /** Profile ids invited to a private channel. */
  channelMembers(channelId: string): Promise<string[]>;
  setChannelMember(channelId: string, profileId: string, on: boolean): Promise<void>;

  /** The latest `limit` messages, returned oldest first. */
  messages(where: MessageWhere, limit: number): Promise<Message[]>;
  message(id: string): Promise<Message | null>;
  /** Body 1..4000 chars. Exactly one of channelId (a chat channel) or threadId (constraint). */
  createMessage(input: NewMessage): Promise<Message>;
  deleteMessage(id: string): Promise<void>;

  /** Threads the profile takes part in, in one community. */
  dmThreads(communityId: string, profileId: string): Promise<DmThread[]>;
  dmThread(id: string): Promise<DmThread | null>;
  dmThreadBetween(communityId: string, x: string, y: string): Promise<DmThread | null>;
  /** Stores the pair ordered (aId < bId); unique per community (constraint). x !== y. */
  createDmThread(communityId: string, x: string, y: string): Promise<DmThread>;
  dmReads(profileId: string, threadIds: readonly string[]): Promise<DmRead[]>;
  /** Upsert on (thread, profile). */
  markDmRead(threadId: string, profileId: string, now: Date): Promise<void>;
  /** Blocks in either direction that involve the profile. */
  blocks(communityId: string, profileId: string): Promise<Block[]>;
  setBlock(row: Block, on: boolean): Promise<void>;
  /** Defaults when no row is stored. */
  communitySettings(communityId: string): Promise<CommunitySettings>;
  /** Upsert on community_id. */
  saveCommunitySettings(row: CommunitySettings): Promise<void>;
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

  // gamification (G12): points ledger is written by triggers on the source rows (SQL) or the
  // withPoints wrapper (fake); repo callers only read it.
  /** Totals per profile with points earned since `since` (null = all time), highest first. */
  pointTotals(communityId: string, since: Date | null): Promise<PointTotal[]>;

  /** Newest start first. */
  challenges(communityId: string): Promise<Challenge[]>;
  challenge(id: string): Promise<Challenge | null>;
  /** Title non-blank, endsAt > startsAt, group of the same community (constraints). */
  createChallenge(input: NewChallenge): Promise<Challenge>;
  updateChallenge(id: string, patch: ChallengePatch): Promise<Challenge>;
  /** Cascades to entries (and their points). */
  deleteChallenge(id: string): Promise<void>;
  /** Oldest first. */
  challengeEntries(challengeId: string): Promise<ChallengeEntry[]>;
  /** One per profile; body 1..5000; createdAt inside the challenge window (constraints). */
  createChallengeEntry(row: ChallengeEntry): Promise<void>;
  deleteChallengeEntry(challengeId: string, profileId: string): Promise<void>;

  /** Soonest start first. */
  meetups(communityId: string): Promise<Meetup[]>;
  meetup(id: string): Promise<Meetup | null>;
  /** Title non-blank, https location, endsAt > startsAt, group and channel of the same community. */
  createMeetup(input: NewMeetup): Promise<Meetup>;
  updateMeetup(id: string, patch: MeetupPatch): Promise<Meetup>;
  /** Cascades to RSVPs. */
  deleteMeetup(id: string): Promise<void>;
  meetupRsvps(meetupId: string): Promise<MeetupRsvp[]>;
  setRsvp(meetupId: string, profileId: string, on: boolean, now: Date): Promise<void>;

  // coaching (G18, G19)
  coachingProgram(productId: string): Promise<CoachingProgram | null>;
  /** Upsert. Product kind coaching; 15..360 minutes; >= 1 session; https location (constraints). */
  saveCoachingProgram(row: CoachingProgram): Promise<void>;
  coachSettings(spaceId: string): Promise<CoachSettings | null>;
  /** Upsert. Valid zone; buffers and notice >= 0; window 1..200 days; cutoff >= 0. */
  saveCoachSettings(row: CoachSettings): Promise<void>;
  availabilityRules(spaceId: string): Promise<AvailabilityRule[]>;
  /** Weekday 0..6; 0 <= start < end <= 1440. */
  createAvailabilityRule(input: NewAvailabilityRule): Promise<AvailabilityRule>;
  deleteAvailabilityRule(id: string): Promise<void>;
  availabilityOverrides(spaceId: string): Promise<AvailabilityOverride[]>;
  /** Date YYYY-MM-DD; both minutes null (day off) or 0 <= start < end <= 1440. */
  createAvailabilityOverride(input: NewAvailabilityOverride): Promise<AvailabilityOverride>;
  deleteAvailabilityOverride(id: string): Promise<void>;
  /** Soonest start first. */
  coachingSessions(where: SessionWhere): Promise<CoachingSession[]>;
  coachingSession(id: string): Promise<CoachingSession | null>;
  /**
   * Coach-made session. end > start, https location, product of the space, and no overlap with
   * another scheduled session of the space (exclusion constraint).
   */
  createCoachingSession(input: NewCoachingSession): Promise<CoachingSession>;
  /**
   * Client booking (SQL: book_coaching_session RPC, atomic). Same checks as createCoachingSession
   * plus: one_on_one product, client holds an active grant at createdAt, and has fewer non-cancelled
   * sessions of the product than sessionsIncluded.
   */
  bookCoachingSession(input: NewCoachingSession & { clientId: string }): Promise<CoachingSession>;
  /** Same checks as create when it stays scheduled. */
  updateCoachingSession(id: string, patch: CoachingSessionPatch): Promise<CoachingSession>;
  sessionNote(sessionId: string): Promise<SessionNote | null>;
  /** Upsert; body up to 20000 chars. */
  saveSessionNote(row: SessionNote): Promise<void>;
  calendarConnection(spaceId: string): Promise<CalendarConnection | null>;
  /** Service role only (Vault). */
  calendarRefreshToken(spaceId: string): Promise<string | null>;
  /** Upsert row + token. */
  saveCalendarConnection(row: CalendarConnection, refreshToken: string): Promise<void>;
  deleteCalendarConnection(spaceId: string): Promise<void>;

  // podcasts and downloads (G18)
  podcastSettings(productId: string): Promise<PodcastSettings | null>;
  /** Upsert. Product kind podcast; author up to 200 chars. */
  savePodcastSettings(row: PodcastSettings): Promise<void>;
  /** Every episode of the podcast, newest created first. */
  episodes(productId: string): Promise<Episode[]>;
  episode(id: string): Promise<Episode | null>;
  /** Podcast product; title non-blank; .mp3 path; 1..EPISODE_MAX_BYTES; season >= 1; duration >= 0. */
  createEpisode(input: NewEpisode): Promise<Episode>;
  updateEpisode(id: string, patch: EpisodePatch): Promise<Episode>;
  deleteEpisode(id: string): Promise<void>;
  /**
   * The viewer's feed token for a podcast, created on first ask (SQL: podcast_feed_token RPC,
   * needs an active grant at `now`).
   */
  podcastFeedToken(productId: string, profileId: string, now: Date): Promise<string>;
  /** New token; the old feed URL stops working (SQL: reset_podcast_feed). */
  resetPodcastFeed(productId: string, profileId: string, now: Date): Promise<string>;
  /** Service role only (SQL: podcast_feed). The feed behind a token while its grant is active. */
  podcastFeedByToken(token: string, now: Date): Promise<PodcastFeed | null>;
  /** Oldest first. */
  productFiles(productId: string): Promise<ProductFile[]>;
  productFile(id: string): Promise<ProductFile | null>;
  /** Download product; title non-blank; size > 0. */
  createProductFile(input: NewProductFile): Promise<ProductFile>;
  renameProductFile(id: string, title: string): Promise<ProductFile>;
  deleteProductFile(id: string): Promise<void>;

  // dev only (fake auth switcher)
  profilesInSpace(spaceId: string): Promise<Profile[]>;
}
