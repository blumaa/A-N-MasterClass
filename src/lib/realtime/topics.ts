// Realtime topic names. SSOT on the TS side; SQL side = public.can_join_live, can_send_live + live_* triggers
// (supabase/migrations/20261112110000_live_topics.sql, 20261112130000_typing_topics.sql). Change both together.

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

/** Typing (item 7). Clients send these; payload = typer's profile id only. */
export const TYPING_EVENTS = { start: 'typing', stop: 'typing_stop' } as const;
export type TypingEvent = (typeof TYPING_EVENTS)[keyof typeof TYPING_EVENTS];

/** Own topics: join = read right, send = post right. Data topics stay database-only. */
export const typingTopic = {
  channel: (channelId: string) => `typing-channel:${channelId}`,
  dm: (threadId: string) => `typing-dm:${threadId}`,
};
