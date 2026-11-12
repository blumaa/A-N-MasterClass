// Web push delivery for in-app notifications. Pure: the sender and the error sink are passed in,
// so tests cover targeting and cleanup without keys or network.
import type { Repo } from '@/lib/data/repo';
import type { PushSubscription } from '@/lib/data/types';

/** One push per recipient. Same text as the in-app notification, nothing more. */
export type PushMessage = { recipientId: string; title: string; body: string; url: string };

export type PushSend = (subscription: PushSubscription, payload: string) => Promise<void>;

export type PushDeps = {
  repo: Pick<Repo, 'pushSubscriptions' | 'deletePushSubscriptions'>;
  send: PushSend;
  report: (error: unknown) => void;
};

/** The push service no longer knows this endpoint (unsubscribed, expired). */
const GONE = new Set([404, 410]);

const statusOf = (error: unknown): number | null =>
  typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : null;

/** Host and status only: the endpoint path is a bearer secret and push bodies can echo payloads. */
function failure(endpoint: string, error: unknown): Error {
  const host = new URL(endpoint).host;
  const status = statusOf(error);
  if (status !== null) return new Error(`Web push to ${host} failed with status ${status}`);
  return new Error(`Web push to ${host} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
}

export const pushPayload = ({ title, body, url }: PushMessage): string => JSON.stringify({ title, body, url });

/** Send each message to every device its recipient subscribed on this space. Dead endpoints are deleted. */
export async function sendPush({ repo, send, report }: PushDeps, spaceId: string, messages: readonly PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const subscriptions = await repo.pushSubscriptions(spaceId, [...new Set(messages.map((m) => m.recipientId))]);
  const gone: string[] = [];
  await Promise.all(
    messages.flatMap((message) =>
      subscriptions
        .filter((s) => s.profileId === message.recipientId)
        .map((s) =>
          send(s, pushPayload(message)).catch((error: unknown) => {
            if (GONE.has(statusOf(error) ?? 0)) gone.push(s.endpoint);
            else report(failure(s.endpoint, error));
          }),
        ),
    ),
  );
  await repo.deletePushSubscriptions(gone);
}
