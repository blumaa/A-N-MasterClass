// Studio labels for channel options (SSOT for editor selects).
import type { ChannelKind, ChannelPrivacy } from '@/lib/data/types';

export const KIND_LABELS: Record<ChannelKind, string> = { feed: 'Feed (posts)', chat: 'Chat (messages)' };
export const PRIVACY_LABELS: Record<ChannelPrivacy, string> = { public: 'Everyone in the group', private: 'Invited members only' };
