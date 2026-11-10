// Domain rows. Mirror supabase/migrations (snake_case there, camelCase here).
import type { Role } from '@/lib/auth/capabilities';
import type { Currency } from '@/lib/commerce/money';
import type { FontId } from '@/lib/fonts/catalog';
import type { PublishStatus } from '@/lib/programs/access';
import type { SiteSection } from '@/lib/site/sections';
import type { BrandColors } from '@/tokens/resolveBrand';

export type { Currency, PublishStatus, Role };

export type Space = {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'live' | 'archived';
  locale: string;
};

/** A host attached to a space (G17). Host stored lowercase. */
export type SpaceDomain = { host: string; spaceId: string; isPrimary: boolean };

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
  /** Order that paid for it; a full refund of that order revokes it (G28). */
  orderId: string | null;
  /** Community products only: access group joined; null = the community's default group. */
  accessGroupId: string | null;
};

export type StepProgress = { profileId: string; stepId: string; completedAt: Date };

// Site builder (G11, G25). Sections live in jsonb; see lib/site/sections.ts.
export const PAGE_KINDS = ['page', 'post'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];
export const LEGAL_KINDS = ['imprint', 'privacy', 'terms'] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export type Page = {
  id: string;
  spaceId: string;
  /** page = /<slug>, post = /blog/<slug>. Slug unique per space + kind. */
  kind: PageKind;
  slug: string;
  title: string;
  /** At most one per space; served at /. Pages only. */
  isHome: boolean;
  legalKind: LegalKind | null;
  seoTitle: string | null;
  seoDescription: string | null;
  draft: SiteSection[];
  /** null = not published (draft only). */
  published: SiteSection[] | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type PageVersion = { id: string; pageId: string; sections: SiteSection[]; publishedAt: Date };

export type NavItem = { label: string; href: string };
export type SiteNav = { spaceId: string; header: NavItem[]; footer: NavItem[] };

// Commerce (G3, G5, G10, G16, G25, G28). One-time offers only in v1.
export type Offer = {
  id: string;
  spaceId: string;
  /** Checkout address: /checkout/<slug>. Unique per space. */
  slug: string;
  title: string;
  description: string | null;
  /** Tax-inclusive (G3). 0 = free offer, no payment provider. */
  priceCents: number;
  currency: Currency;
  status: PublishStatus;
};

/** accessGroupId: for a community product, the group the buyer joins (null = default group). */
export type OfferProduct = { offerId: string; productId: string; accessGroupId: string | null };
export type OfferItem = Omit<OfferProduct, 'offerId'>;

export const PAYMENT_ENVS = ['sandbox', 'live'] as const;
export type PaymentEnv = (typeof PAYMENT_ENVS)[number];

export const ORDER_PROVIDERS = ['paypal', 'fake', 'free'] as const;
export type OrderProvider = (typeof ORDER_PROVIDERS)[number];

/** paid/partially_refunded/refunded follow PayPal's capture status. Full refund revokes grants. */
export const ORDER_STATUSES = ['created', 'paid', 'partially_refunded', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Order = {
  id: string;
  spaceId: string;
  offerId: string;
  /** Set on fulfilment (buyer found or created by email). */
  profileId: string | null;
  email: string;
  provider: OrderProvider;
  /** PayPal order id. Unique per provider. */
  providerOrderId: string;
  /** PayPal capture id = fulfilment idempotency key. Unique per provider. */
  captureId: string | null;
  status: OrderStatus;
  /** Price copied from the offer at order time; capture must match it. */
  amountCents: number;
  currency: Currency;
  /** false = sandbox/fake: kept out of revenue (G10). */
  livemode: boolean;
  /** Withdrawal waiver for digital content (G25): exact text version accepted. */
  waiverVersion: string;
  waiverAcceptedAt: Date;
  marketingConsent: boolean;
  createdAt: Date;
  paidAt: Date | null;
};

/** One PayPal REST app per space and env (G28). Secret lives apart (Vault in SQL). */
export type PaymentCredentials = {
  spaceId: string;
  env: PaymentEnv;
  clientId: string;
  webhookId: string | null;
  updatedAt: Date;
};

/** Buyers, students and opt-ins for the instructor's own mailing tool (G16). */
export type Contact = {
  spaceId: string;
  email: string;
  profileId: string | null;
  marketingConsent: boolean;
  consentAt: Date | null;
  consentSource: string | null;
  createdAt: Date;
};

/** Single-use account claim link, 10 days (G4). Only the sha256 of the token is stored. */
export type ClaimToken = {
  tokenHash: string;
  spaceId: string;
  profileId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

// Community (G12, G13, G15). Launch 1 = feed channels. A community is a product (kind 'community'):
// members are grant holders; owner/admin reach every community, other staff only ticked ones.
/**
 * Access group (Kajabi): a tier inside a community. Each grant of a community joins one group;
 * a member may hold several. Channels, challenges and meetups belong to one group. Feature
 * toggles gate the member directory, starting DMs, challenges, meetups and the leaderboard.
 * Every community has exactly one default group.
 */
export type AccessGroup = {
  id: string;
  communityId: string;
  title: string;
  isDefault: boolean;
  directory: boolean;
  dms: boolean;
  challenges: boolean;
  meetups: boolean;
  leaderboard: boolean;
};
/** Per-group feature toggles; all on for a new group. */
export const GROUP_FEATURES = ['directory', 'dms', 'challenges', 'meetups', 'leaderboard'] as const;
export type GroupFeature = (typeof GROUP_FEATURES)[number];
/** New access groups get every feature (Kajabi default: all toggles on). */
export const ALL_GROUP_FEATURES: Record<GroupFeature, boolean> = {
  directory: true,
  dms: true,
  challenges: true,
  meetups: true,
  leaderboard: true,
};

/** feed = posts + comments + reactions; chat = a running list of short messages. */
export const CHANNEL_KINDS = ['feed', 'chat'] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];
/** public = every member of the channel's group; private = only invited members of that group. */
export const CHANNEL_PRIVACIES = ['public', 'private'] as const;
export type ChannelPrivacy = (typeof CHANNEL_PRIVACIES)[number];

export type Channel = {
  id: string;
  communityId: string;
  accessGroupId: string;
  title: string;
  kind: ChannelKind;
  privacy: ChannelPrivacy;
  /** Only moderators post (feed) or send (chat); members still comment and react on feed posts. */
  readOnly: boolean;
  position: number;
};

/** Invited members of a private channel. */
export type ChannelMember = { channelId: string; profileId: string };

/** A chat line, in a chat channel or a DM thread (exactly one of the two). */
export type Message = {
  id: string;
  channelId: string | null;
  threadId: string | null;
  authorId: string;
  body: string;
  createdAt: Date;
};

/** 1:1 DM inside one community. aId < bId; unique per (community, aId, bId). */
export type DmThread = { id: string; communityId: string; aId: string; bId: string };
/** Last time a participant opened the thread; later messages by the other side are unread. */
export type DmRead = { threadId: string; profileId: string; readAt: Date };
/** Blocker hides from and stops messages with the blocked member (either direction). */
export type Block = { communityId: string; blockerId: string; blockedId: string };
/**
 * Points (Kajabi gamification): what earns them. comment = a comment on a feed post;
 * reaction_given / reaction_received = first reaction by a member on someone else's post;
 * dm = a direct message sent; challenge = a challenge entry.
 */
export const POINT_REASONS = ['comment', 'reaction_given', 'reaction_received', 'dm', 'challenge'] as const;
export type PointReason = (typeof POINT_REASONS)[number];
/** Kajabi's default point values. */
export const DEFAULT_POINT_VALUES: Readonly<Record<PointReason, number>> = {
  comment: 3,
  reaction_given: 1,
  reaction_received: 1,
  dm: 1,
  challenge: 100,
};
export const POINT_VALUE_MAX = 1_000;
/** Who sees the leaderboard: members (and staff), staff only, nobody. */
export const LEADERBOARD_VISIBILITIES = ['members', 'staff', 'off'] as const;
export type LeaderboardVisibility = (typeof LEADERBOARD_VISIBILITIES)[number];

/** No row = defaults (DMs on, founder reachable, points on, leaderboard for members, default values). */
export type CommunitySettings = {
  communityId: string;
  dmsEnabled: boolean;
  founderDms: boolean;
  pointsEnabled: boolean;
  leaderboard: LeaderboardVisibility;
  /** Overrides of DEFAULT_POINT_VALUES, 0..POINT_VALUE_MAX; 0 = this action earns nothing. */
  pointValues: Partial<Record<PointReason, number>>;
};
export const DEFAULT_COMMUNITY_SETTINGS: Omit<CommunitySettings, 'communityId'> = {
  dmsEnabled: true,
  founderDms: true,
  pointsEnabled: true,
  leaderboard: 'members',
  pointValues: {},
};

/**
 * Append-only points ledger. Points are fixed when earned (a later value change is not
 * retroactive); the row goes away with its source (comment, reaction, message, entry).
 * Unique (reason, sourceKey, profileId).
 */
export type PointsEntry = {
  communityId: string;
  profileId: string;
  reason: PointReason;
  sourceKey: string;
  points: number;
  createdAt: Date;
};
export type PointTotal = { profileId: string; points: number };

/** Challenge (Kajabi): a time-boxed task for one access group; members submit one entry. */
export type Challenge = {
  id: string;
  communityId: string;
  accessGroupId: string;
  title: string;
  description: string;
  prize: string | null;
  startsAt: Date;
  /** After startsAt (constraint). */
  endsAt: Date;
  /** Members see it before it starts. */
  showBeforeStart: boolean;
  createdAt: Date;
};
/** One per (challenge, profile). Body 1..5000 chars, sent inside the challenge window. */
export type ChallengeEntry = { challengeId: string; profileId: string; body: string; createdAt: Date };

/**
 * Meetup (G14): scheduled event for one access group with an external join link (Zoom/Meet),
 * shown from shortly before the start until the end. Stored UTC plus the host's IANA zone.
 */
export type Meetup = {
  id: string;
  communityId: string;
  accessGroupId: string;
  /** Optional channel where it is discussed. */
  channelId: string | null;
  title: string;
  description: string;
  /** Join link (https). */
  location: string;
  timeZone: string;
  startsAt: Date;
  endsAt: Date;
  replayVimeoId: string | null;
  createdAt: Date;
};
export type MeetupRsvp = { meetupId: string; profileId: string; createdAt: Date };

/** space_member_communities: assistant/support staff ticked for this community (G15). */
export type CommunityStaff = { communityId: string; profileId: string };

export type Post = {
  id: string;
  channelId: string;
  authorId: string;
  /** Plain text with @[Name](id) mention markup. */
  body: string;
  pinned: boolean;
  createdAt: Date;
  /** Hidden by a moderator: only moderators still see it. */
  hiddenAt: Date | null;
};

/** Comments hang off a feed post or a program step (lesson comments). */
export const COMMENT_TARGETS = ['post', 'step'] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

export type Comment = {
  id: string;
  spaceId: string;
  targetType: CommentTarget;
  targetId: string;
  /** One reply level: a reply's parent is always a top-level comment on the same target. */
  parentId: string | null;
  authorId: string;
  body: string;
  createdAt: Date;
  hiddenAt: Date | null;
};

export const REACTION_TARGETS = ['post', 'comment'] as const;
export type ReactionTarget = (typeof REACTION_TARGETS)[number];

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🙏', '🔥', '👏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Unique (target, profile, emoji). */
export type Reaction = {
  targetType: ReactionTarget;
  targetId: string;
  profileId: string;
  emoji: ReactionEmoji;
  createdAt: Date;
};

/**
 * comment = someone commented on your post; reply = someone replied to your comment;
 * step_comment = new lesson comment (to staff with comments.moderate); mention; reaction.
 */
export const NOTIFICATION_TYPES = ['comment', 'reply', 'step_comment', 'mention', 'reaction'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type Notification = {
  id: string;
  spaceId: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  /** Where it points: a post, or a step (lesson comments). */
  postId: string | null;
  stepId: string | null;
  createdAt: Date;
  readAt: Date | null;
};
