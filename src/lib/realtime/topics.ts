// Realtime topic names. SSOT on the TS side; SQL side = public.can_join_live + live_* triggers
// (supabase/migrations/20261112110000_live_topics.sql). Change both together.

/** Only event the database sends: "what you show here is stale". Payload carries nothing. */
export const LIVE_EVENT = 'stale';

export const liveTopic = {
  /** Chat lines or feed posts of one channel (and comments/reactions on its posts). */
  channel: (channelId: string) => `channel:${channelId}`,
  /** One post: the post, its comments, reactions. */
  post: (postId: string) => `post:${postId}`,
  /** One DM thread. */
  dm: (threadId: string) => `dm:${threadId}`,
  /** Any DM thread of this profile (inbox list). */
  inbox: (profileId: string) => `inbox:${profileId}`,
};
