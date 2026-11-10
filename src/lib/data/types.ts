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

export type OfferProduct = { offerId: string; productId: string };

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
/** public = every member posts; read_only = only moderators post, members comment + react. */
export const CHANNEL_VISIBILITIES = ['public', 'read_only'] as const;
export type ChannelVisibility = (typeof CHANNEL_VISIBILITIES)[number];

export type Channel = {
  id: string;
  communityId: string;
  title: string;
  visibility: ChannelVisibility;
  position: number;
};

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
