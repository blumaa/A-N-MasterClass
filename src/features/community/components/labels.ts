// Labels for channel, points, leaderboard and push type options (SSOT for selects and switches).
import type { ChannelKind, ChannelPrivacy, LeaderboardVisibility, NotificationType, PointReason } from '@/lib/data/types';

export const KIND_LABELS: Record<ChannelKind, string> = { feed: 'Feed (posts)', chat: 'Chat (messages)' };
export const PRIVACY_LABELS: Record<ChannelPrivacy, string> = { public: 'Everyone in the group', private: 'Invited members only' };

export const POINT_REASON_LABELS: Record<PointReason, string> = {
  comment: 'Posting or commenting',
  reaction_given: 'Reacting to others',
  reaction_received: 'Receiving a reaction',
  dm: 'Sending a direct message',
  challenge: 'Entering a challenge',
};
export const LEADERBOARD_LABELS: Record<LeaderboardVisibility, string> = {
  members: 'Members and staff',
  staff: 'Staff only',
  off: 'Hidden',
};

/** Member push settings, one switch per notification type. */
export const PUSH_TYPE_LABELS: Record<NotificationType, string> = {
  comment: 'Comments on my posts',
  reply: 'Replies to my comments',
  step_comment: 'Lesson comments (staff)',
  mention: 'Mentions',
  reaction: 'Reactions',
  report: 'Reports to review (moderators)',
};
