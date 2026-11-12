// Web push for in-app notifications (Launch 6 item 6). Lives in app/: the URL needs both
// community and programs paths (notificationHref), and features never import each other.
import { describeNotifications } from '@/features/community/api/notifications';
import type { NewNotification, Repo } from '@/lib/data/repo';
import type { Space } from '@/lib/data/types';
import type { PushMessage } from '@/lib/push/send';
import { notificationHref } from './(site)/(learn)/notifications/notificationHref';

/** Same text and target as the in-app notification; title is the space name, icon the space icon. */
export async function pushMessages(repo: Repo, space: Space, rows: readonly NewNotification[], icon: string | null): Promise<PushMessage[]> {
  // describeNotifications keeps rows 1:1 and in order.
  const texts = await describeNotifications(repo, space.id, rows);
  return texts.map((t, i) => ({
    recipientId: t.recipientId,
    type: rows[i].type,
    title: space.name,
    body: t.text,
    url: notificationHref(t.link) ?? '/',
    icon,
  }));
}

type Schedule = (task: () => Promise<void>) => void;
type Push = (rows: readonly NewNotification[]) => Promise<void>;

/** Repo whose addNotifications also pushes, after the write and outside the response. */
export function withPush(repo: Repo, schedule: Schedule, push: Push): Repo {
  return {
    ...repo,
    async addNotifications(rows) {
      await repo.addNotifications(rows);
      schedule(() => push(rows));
    },
  };
}
