// Who hears about a community action. Pure: callers list candidates in priority order
// (reply > comment > mention > reaction > step_comment); each person gets one row.
import type { NewNotification } from '@/lib/data/repo';
import type { NotificationType } from '@/lib/data/types';

export type NotificationBase = Omit<NewNotification, 'recipientId' | 'type'>;
export type Candidate = { recipientId: string; type: NotificationType };

export function buildNotifications(
  base: NotificationBase,
  candidates: readonly Candidate[],
  canReceive: (profileId: string) => boolean,
): NewNotification[] {
  const seen = new Set<string>([base.actorId]);
  const rows: NewNotification[] = [];
  for (const { recipientId, type } of candidates) {
    if (seen.has(recipientId) || !canReceive(recipientId)) continue;
    seen.add(recipientId);
    rows.push({ ...base, recipientId, type });
  }
  return rows;
}
