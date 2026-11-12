// Composition root for web push. Null = push off: fake data (never sends) or no VAPID keys.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import { pushConfig } from '@/config/push';
import type { PushSend } from './send';
import { webPushSender } from './webPushSender';

export function getPushSender(): PushSend | null {
  if (dataSource() === 'fake') return null;
  const config = pushConfig();
  return config ? webPushSender(config) : null;
}

/** Public key for the browser subscribe call. Null hides the push switch. */
export function pushPublicKey(): string | null {
  return pushConfig()?.publicKey ?? null;
}
