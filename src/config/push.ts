// Web push (VAPID) config SSOT. Only module that reads VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// and VAPID_SUBJECT. All unset = push off (not an error). Generate keys with
// `npx web-push generate-vapid-keys`.

type Env = Record<string, string | undefined>;

export type PushConfig = { publicKey: string; privateKey: string; subject: string };

const KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;

export function readPushConfig(env: Env): PushConfig | null {
  const values = KEYS.map((k) => env[k]?.trim() ?? '');
  if (values.every((v) => v === '')) return null;
  const missing = KEYS.filter((_, i) => values[i] === '');
  if (missing.length > 0) throw new Error(`Web push is half configured; missing ${missing.join(', ')}`);
  const [publicKey, privateKey, subject] = values as [string, string, string];
  if (!/^(mailto:|https:\/\/)/.test(subject)) throw new Error('VAPID_SUBJECT must start with mailto: or https://');
  return { publicKey, privateKey, subject };
}

export const pushConfig = (): PushConfig | null => readPushConfig(process.env);
