// Notification link -> URL. Lives in app/: post and report links are community paths, step links programs paths.
import type { NotificationLink } from '@/features/community/api/notifications';
import { postHref, reportsHref } from '@/features/community/paths';
import { stepHref } from '@/features/programs/paths';

export function notificationHref(link: NotificationLink | null): string | null {
  if (!link) return null;
  switch (link.kind) {
    case 'post':
      return postHref(link.community, link.postId);
    case 'step':
      return stepHref(link.program, link.stepId);
    case 'reports':
      return reportsHref(link.community);
  }
}
