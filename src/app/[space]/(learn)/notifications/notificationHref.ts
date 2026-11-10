// Notification link -> URL. Lives in app/: post links are community paths, step links programs paths.
import type { NotificationLink } from '@/features/community/api/notifications';
import { postHref } from '@/features/community/paths';
import { stepHref } from '@/features/programs/paths';

export function notificationHref(link: NotificationLink | null): string | null {
  if (!link) return null;
  return link.kind === 'post' ? postHref(link.community, link.postId) : stepHref(link.program, link.stepId);
}
