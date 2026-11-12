// In-memory tables for DATA_SOURCE=fake. REPLACED BY: Supabase tables (supabase/migrations).
import type {
  AccessGroup,
  AvailabilityOverride,
  AvailabilityRule,
  CalendarConnection,
  CoachingProgram,
  CoachingSession,
  CoachSettings,
  Episode,
  PodcastFeed,
  PodcastSettings,
  ProductFile,
  SessionNote,
  Block,
  Challenge,
  ChallengeEntry,
  Meetup,
  MeetupOccurrence,
  MeetupRsvp,
  PointsEntry,
  Channel,
  ChannelMember,
  CommunitySettings,
  DmRead,
  DmThread,
  Message,
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
  PostPhoto,
  Product,
  Profile,
  PushSubscription,
  Reaction,
  SiteNav,
  Space,
  SpaceDomain,
  SpaceBranding,
  SpaceProfile,
  Step,
  StepProgress,
} from '../types';
import type { FakeReport } from './fakeModerationRepo';

export type Db = {
  spaces: Space[];
  spaceDomains: SpaceDomain[];
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
  accessGroups: AccessGroup[];
  channels: Channel[];
  channelMembers: ChannelMember[];
  channelModerators: ChannelMember[];
  reports: FakeReport[];
  messages: Message[];
  dmThreads: DmThread[];
  dmReads: DmRead[];
  blocks: Block[];
  communitySettings: CommunitySettings[];
  communityStaff: CommunityStaff[];
  posts: Post[];
  postPhotos: PostPhoto[];
  comments: Comment[];
  reactions: Reaction[];
  notifications: Notification[];
  pushSubscriptions: PushSubscription[];
  pointsLedger: PointsEntry[];
  challenges: Challenge[];
  challengeEntries: ChallengeEntry[];
  meetups: Meetup[];
  meetupOccurrences: MeetupOccurrence[];
  meetupRsvps: MeetupRsvp[];
  coachingPrograms: CoachingProgram[];
  coachSettings: CoachSettings[];
  availabilityRules: AvailabilityRule[];
  availabilityOverrides: AvailabilityOverride[];
  coachingSessions: CoachingSession[];
  sessionNotes: SessionNote[];
  calendarConnections: CalendarConnection[];
  /** Stands in for Supabase Vault. */
  calendarSecrets: { spaceId: string; refreshToken: string }[];
  podcasts: PodcastSettings[];
  episodes: Episode[];
  podcastFeeds: PodcastFeed[];
  productFiles: ProductFile[];
};

export const emptyDb = (): Db => ({
  spaces: [],
  spaceDomains: [],
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
  accessGroups: [],
  channels: [],
  channelMembers: [],
  channelModerators: [],
  reports: [],
  messages: [],
  dmThreads: [],
  dmReads: [],
  blocks: [],
  communitySettings: [],
  communityStaff: [],
  posts: [],
  postPhotos: [],
  comments: [],
  reactions: [],
  notifications: [],
  pushSubscriptions: [],
  pointsLedger: [],
  challenges: [],
  challengeEntries: [],
  meetups: [],
  meetupOccurrences: [],
  meetupRsvps: [],
  coachingPrograms: [],
  coachSettings: [],
  availabilityRules: [],
  availabilityOverrides: [],
  coachingSessions: [],
  sessionNotes: [],
  calendarConnections: [],
  calendarSecrets: [],
  podcasts: [],
  episodes: [],
  podcastFeeds: [],
  productFiles: [],
});
