// Studio labels for channel, points and leaderboard options (SSOT for editor selects).
import type { ChannelKind, ChannelPrivacy, LeaderboardVisibility, PointReason } from '@/lib/data/types';

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
