// Moderation log writes (hide, unhide, lock, unlock, approve, reject). The DB takes channel and
// community from the target (moderation_log_target trigger).
import type { Repo } from '@/lib/data/repo';
import type { ModerationAction } from '@/lib/data/types';

export const logModeration = (
  repo: Repo,
  actorId: string,
  action: ModerationAction,
  targetType: 'post' | 'comment',
  targetId: string,
  createdAt: Date,
): Promise<void> => repo.logModeration({ actorId, action, targetType, targetId, createdAt });
