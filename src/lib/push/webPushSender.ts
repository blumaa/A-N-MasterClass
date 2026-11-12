// The real PushSend: web-push signs with VAPID and encrypts the payload (RFC 8291).
// Keys go per call (no global setVapidDetails), so nothing leaks between configs.
// Docs: https://github.com/web-push-libs/web-push#sendnotificationpushsubscription-payload-options
import 'server-only';
import { sendNotification } from 'web-push';
import type { PushConfig } from '@/config/push';
import type { PushSend } from './send';

/** Seconds the push service keeps a message for an offline device. */
const TTL = 24 * 60 * 60;
const TIMEOUT_MS = 10_000;

export const webPushSender =
  ({ publicKey, privateKey, subject }: PushConfig): PushSend =>
  async (subscription, payload) => {
    await sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, {
      vapidDetails: { subject, publicKey, privateKey },
      TTL,
      urgency: 'high',
      timeout: TIMEOUT_MS,
    });
  };
