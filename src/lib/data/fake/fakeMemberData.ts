// Member data export and per-space erase (G25), fake part. Same scope as member_space_data and
// erase_member_space in supabase/migrations/20261113000000_member_data.sql and
// 20261120000000_member_data_coverage.sql. The fake has no video positions, so that key is always empty.
import type { Repo } from '../repo';
import type { Db } from './db';

type MemberDataRepo = Pick<Repo, 'memberSpaceData' | 'eraseMemberSpace' | 'deleteAccount'>;

/** Ids of the space's products, steps, parts, channels and the member's DM threads. */
function scope(db: Db, spaceId: string, profileId: string) {
  const products = new Set(db.products.filter((p) => p.spaceId === spaceId).map((p) => p.id));
  const modules = new Set(db.modules.filter((m) => products.has(m.programId)).map((m) => m.id));
  const steps = new Set(db.steps.filter((s) => modules.has(s.moduleId)).map((s) => s.id));
  const parts = new Set(db.parts.filter((p) => steps.has(p.stepId)).map((p) => p.id));
  const channels = new Set(db.channels.filter((c) => products.has(c.communityId)).map((c) => c.id));
  const threads = new Set(
    db.dmThreads.filter((t) => products.has(t.communityId) && (t.aId === profileId || t.bId === profileId)).map((t) => t.id),
  );
  const posts = new Set(db.posts.filter((p) => channels.has(p.channelId)).map((p) => p.id));
  const comments = new Set(db.comments.filter((c) => c.spaceId === spaceId).map((c) => c.id));
  return { products, steps, parts, channels, threads, posts, comments };
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

type Scope = ReturnType<typeof scope>;

/** Rows from the person-linked tables added after the first export; mirrors 20261120000000_member_data_coverage.sql. */
function personLinked(db: Db, spaceId: string, profileId: string, s: Scope) {
  const productTitle = (id: string) => db.products.find((p) => p.id === id)?.title ?? '';
  const channelTitle = (id: string) => db.channels.find((c) => c.id === id)?.title ?? '';
  const named = <T>(rows: T[], title: (row: T) => string) =>
    rows.map((r) => ({ row: r, title: title(r) })).sort(byTitle);
  const threadMine = (t: { communityId: string; aId: string; bId: string }) =>
    s.products.has(t.communityId) && (t.aId === profileId || t.bId === profileId);
  return {
    notifications_sent: db.notifications
      .filter((n) => n.spaceId === spaceId && n.actorId === profileId)
      .map((n) => ({ type: n.type, post_id: n.postId, step_id: n.stepId, created_at: n.createdAt })),
    moderation_log: db.moderationLog
      .filter((l) => l.actorId === profileId && s.products.has(l.communityId))
      .map((l) => ({ action: l.action, target_type: l.targetType, target_id: l.targetId, created_at: l.createdAt })),
    post_approval_members: named(
      db.postApprovalMembers.filter((a) => a.profileId === profileId && s.products.has(a.communityId)),
      (a) => productTitle(a.communityId),
    ).map((x) => ({ community: x.title })),
    push_mutes: db.pushMutes.filter((m) => m.spaceId === spaceId && m.profileId === profileId).map((m) => ({ type: m.type })),
    push_subscriptions: db.pushSubscriptions
      .filter((p) => p.spaceId === spaceId && p.profileId === profileId)
      .map((p) => ({ endpoint: p.endpoint, user_agent: p.userAgent })),
    claim_tokens: db.claimTokens
      .filter((t) => t.spaceId === spaceId && t.profileId === profileId)
      .map((t) => ({ expires_at: t.expiresAt, used_at: t.usedAt })),
    channel_members: named(
      db.channelMembers.filter((c) => c.profileId === profileId && s.channels.has(c.channelId)),
      (c) => channelTitle(c.channelId),
    ).map((x) => ({ channel: x.title })),
    channel_moderators: named(
      db.channelModerators.filter((c) => c.profileId === profileId && s.channels.has(c.channelId)),
      (c) => channelTitle(c.channelId),
    ).map((x) => ({ channel: x.title })),
    community_staff: named(
      db.communityStaff.filter((c) => c.profileId === profileId && s.products.has(c.communityId)),
      (c) => productTitle(c.communityId),
    ).map((x) => ({ community: x.title })),
    dm_threads: db.dmThreads.filter(threadMine).map((t) => ({ id: t.id, community: productTitle(t.communityId) })),
    dm_reads: db.dmReads.filter((r) => r.profileId === profileId && s.threads.has(r.threadId)).map((r) => ({ thread_id: r.threadId, read_at: r.readAt })),
    blocks: db.blocks
      .filter((b) => b.blockerId === profileId && s.products.has(b.communityId))
      .map((b) => ({
        community: productTitle(b.communityId),
        blocked: db.spaceProfiles.find((p) => p.spaceId === spaceId && p.profileId === b.blockedId)?.displayName ?? null,
      })),
    reports: db.reports
      .filter((r) => r.reporterId === profileId && s.products.has(r.communityId))
      .map((r) => ({ target_type: r.targetType, target_id: r.targetId, reason: r.reason, status: r.status, created_at: r.createdAt })),
    podcast_feeds: db.podcastFeeds
      .filter((f) => f.profileId === profileId && s.products.has(f.productId))
      .map((f) => ({ podcast: productTitle(f.productId), created_at: f.createdAt })),
  };
}

export function createFakeMemberData(db: Db): MemberDataRepo {
  return {
    async memberSpaceData(spaceId, profileId) {
      const s = scope(db, spaceId, profileId);
      const mine = <T extends { profileId: string | null }>(rows: T[]) => rows.filter((r) => r.profileId === profileId);
      const profile = db.spaceProfiles.find((p) => p.spaceId === spaceId && p.profileId === profileId);
      const email = db.profiles.find((p) => p.id === profileId)?.email;
      return {
        account: email === undefined ? null : { email },
        profile: profile ? { display_name: profile.displayName, avatar_path: profile.avatarPath, bio: profile.bio } : null,
        role: db.members.find((m) => m.spaceId === spaceId && m.profileId === profileId)?.role ?? null,
        access: mine(db.grants)
          .filter((g) => s.products.has(g.productId))
          .map((g) => ({
            product: db.products.find((p) => p.id === g.productId)?.title,
            source: g.source,
            status: g.status,
            granted_at: g.grantedAt,
            expires_at: g.expiresAt,
          })),
        orders: mine(db.orders)
          .filter((o) => o.spaceId === spaceId)
          .map((o) => ({ id: o.id, email: o.email, amount_cents: o.amountCents, currency: o.currency, status: o.status, created_at: o.createdAt })),
        subscriptions: mine(db.subscriptions).filter((x) => x.spaceId === spaceId),
        contact: db.contacts.find((c) => c.spaceId === spaceId && c.profileId === profileId) ?? null,
        progress: mine(db.stepProgress).filter((p) => s.steps.has(p.stepId)).map((p) => ({ step_id: p.stepId, completed_at: p.completedAt })),
        video_positions: [],
        quiz_attempts: mine(db.quizAttempts).filter((q) => s.parts.has(q.partId)),
        certificates: mine(db.certificates).filter((c) => s.products.has(c.programId)),
        posts: db.posts
          .filter((p) => p.authorId === profileId && s.channels.has(p.channelId))
          .map((p) => ({ id: p.id, body: p.body, created_at: p.createdAt })),
        comments: db.comments
          .filter((c) => c.spaceId === spaceId && c.authorId === profileId)
          .map((c) => ({ id: c.id, on: c.targetType, body: c.body, created_at: c.createdAt })),
        reactions: mine(db.reactions)
          .filter((r) => (r.targetType === 'post' ? s.posts : s.comments).has(r.targetId))
          .map((r) => ({ on: r.targetType, target_id: r.targetId, emoji: r.emoji, created_at: r.createdAt })),
        messages: db.messages
          .filter((m) => m.authorId === profileId && ((m.channelId && s.channels.has(m.channelId)) || (m.threadId && s.threads.has(m.threadId))))
          .map((m) => ({ id: m.id, body: m.body, attachment: m.attachment?.name ?? null, created_at: m.createdAt })),
        challenge_entries: mine(db.challengeEntries).filter((e) =>
          s.products.has(db.challenges.find((c) => c.id === e.challengeId)?.communityId ?? ''),
        ),
        meetup_rsvps: mine(db.meetupRsvps).filter((r) => s.products.has(db.meetups.find((m) => m.id === r.meetupId)?.communityId ?? '')),
        points: mine(db.pointsLedger).filter((l) => s.products.has(l.communityId)),
        coaching_sessions: db.coachingSessions.filter((x) => x.spaceId === spaceId && x.clientId === profileId),
        notifications: db.notifications.filter((n) => n.spaceId === spaceId && n.recipientId === profileId),
        ...personLinked(db, spaceId, profileId, s),
      };
    },

    async eraseMemberSpace(spaceId, profileId) {
      if (db.members.some((m) => m.spaceId === spaceId && m.profileId === profileId && m.role === 'owner')) {
        throw new Error('owner cannot leave the space');
      }
      const s = scope(db, spaceId, profileId);
      const me = (id: string | null) => id === profileId;
      const inSpace = (communityId: string) => s.products.has(communityId);

      const myPosts = new Set(db.posts.filter((p) => me(p.authorId) && s.channels.has(p.channelId)).map((p) => p.id));
      const goneMessages = db.messages.filter(
        (m) => (me(m.authorId) && m.channelId !== null && s.channels.has(m.channelId)) || (m.threadId !== null && s.threads.has(m.threadId)),
      );
      const goneMessageIds = new Set(goneMessages.map((m) => m.id));
      const challenges = new Set(db.challenges.filter((c) => inSpace(c.communityId)).map((c) => c.id));
      const meetups = new Set(db.meetups.filter((m) => inSpace(m.communityId)).map((m) => m.id));

      db.postPhotos = db.postPhotos.filter((ph) => !myPosts.has(ph.postId));
      db.posts = db.posts.filter((p) => !myPosts.has(p.id));
      db.comments = db.comments.filter((c) => !(c.spaceId === spaceId && me(c.authorId)));
      db.reactions = db.reactions.filter((r) => !(me(r.profileId) && (r.targetType === 'post' ? s.posts : s.comments).has(r.targetId)));
      db.messages = db.messages.filter((m) => !goneMessageIds.has(m.id));
      db.dmReads = db.dmReads.filter((r) => !s.threads.has(r.threadId));
      db.dmThreads = db.dmThreads.filter((t) => !s.threads.has(t.id));
      db.channelMembers = db.channelMembers.filter((c) => !(me(c.profileId) && s.channels.has(c.channelId)));
      db.channelModerators = db.channelModerators.filter((c) => !(me(c.profileId) && s.channels.has(c.channelId)));
      db.blocks = db.blocks.filter((b) => !(inSpace(b.communityId) && (me(b.blockerId) || me(b.blockedId))));
      db.reports = db.reports.filter((r) => !(me(r.reporterId) && inSpace(r.communityId)));
      db.pointsLedger = db.pointsLedger.filter((l) => !(me(l.profileId) && inSpace(l.communityId)));
      db.challengeEntries = db.challengeEntries.filter((e) => !(me(e.profileId) && challenges.has(e.challengeId)));
      db.meetupRsvps = db.meetupRsvps.filter((r) => !(me(r.profileId) && meetups.has(r.meetupId)));
      db.communityStaff = db.communityStaff.filter((c) => !(me(c.profileId) && inSpace(c.communityId)));
      db.stepProgress = db.stepProgress.filter((p) => !(me(p.profileId) && s.steps.has(p.stepId)));
      db.quizAttempts = db.quizAttempts.filter((q) => !(me(q.profileId) && s.parts.has(q.partId)));
      db.certificates = db.certificates.filter((c) => !(me(c.profileId) && s.products.has(c.programId)));
      db.podcastFeeds = db.podcastFeeds.filter((f) => !(me(f.profileId) && s.products.has(f.productId)));
      db.coachingSessions = db.coachingSessions.filter((x) => !(x.spaceId === spaceId && me(x.clientId)));
      db.grants = db.grants.filter((g) => !(me(g.profileId) && s.products.has(g.productId)));
      db.notifications = db.notifications.filter((n) => !(n.spaceId === spaceId && (me(n.recipientId) || me(n.actorId))));
      db.pushSubscriptions = db.pushSubscriptions.filter((p) => !(p.spaceId === spaceId && me(p.profileId)));
      db.pushMutes = db.pushMutes.filter((p) => !(p.spaceId === spaceId && me(p.profileId)));
      db.claimTokens = db.claimTokens.filter((t) => !(t.spaceId === spaceId && me(t.profileId)));
      db.contacts = db.contacts.filter((c) => !(c.spaceId === spaceId && me(c.profileId)));
      for (const o of db.orders) if (o.spaceId === spaceId && me(o.profileId)) o.profileId = null;
      for (const x of db.subscriptions) if (x.spaceId === spaceId && me(x.profileId)) x.profileId = null;
      db.members = db.members.filter((m) => !(m.spaceId === spaceId && me(m.profileId)));
      db.spaceProfiles = db.spaceProfiles.filter((p) => !(p.spaceId === spaceId && me(p.profileId)));

      const remaining =
        db.spaceProfiles.some((p) => me(p.profileId)) || db.members.some((m) => me(m.profileId)) || db.grants.some((g) => me(g.profileId));
      return { lastSpace: !remaining };
    },

    async deleteAccount(profileId) {
      db.profiles = db.profiles.filter((p) => p.id !== profileId);
    },
  };
}
