// Composition: wires withPush to next/server after(), the service repo and the web-push sender.
import 'server-only';
import { after } from 'next/server';
import { getServiceRepo } from '@/lib/data/getRepo';
import type { Repo } from '@/lib/data/repo';
import type { Space } from '@/lib/data/types';
import { reportError } from '@/lib/errors/report';
import { getPushSender } from '@/lib/push/getPushSender';
import { sendPush } from '@/lib/push/send';
import { pushMessages, withPush } from './pushNotifications';

/** The repo for a member write on this space: pushes when push is on, else the repo as is. */
export function pushingRepo(repo: Repo, space: Space): Repo {
  const send = getPushSender();
  if (!send) return repo;
  return withPush(repo, after, async (rows) => {
    // Service role: reads other members' subscriptions and names, after the member's request.
    const service = getServiceRepo();
    await sendPush({ repo: service, send, report: reportError }, space.id, await pushMessages(service, space, rows));
  });
}
