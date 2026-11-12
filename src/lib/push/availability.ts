// Pure push decisions for the browser side, so tests walk every case without a browser.
// Ported from kinbaku-study-group lib/push (config.ts, push.ts, prompt.ts).

export type BrowserPush = {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  ios: boolean;
  /** Launched from the home screen (display-mode: standalone or navigator.standalone). */
  standalone: boolean;
  permission: NotificationPermission;
};

/**
 * ready: the switch works. install: iOS/iPadOS Safari only gets push for a home-screen app
 * (16.4+, https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
 * unsupported: no Push API. blocked: the member refused notifications for this site.
 */
export type PushAvailability = 'ready' | 'install' | 'unsupported' | 'blocked';

export function pushAvailability(b: BrowserPush): PushAvailability {
  if (b.ios && !b.standalone) return 'install';
  if (!b.serviceWorker || !b.pushManager || !b.notification) return 'unsupported';
  return b.permission === 'denied' ? 'blocked' : 'ready';
}

/** iPadOS 13+ reports itself as a Mac; touch points give it away. */
export const isIos = (userAgent: string, platform: string, maxTouchPoints: number): boolean =>
  /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);

/** VAPID public key (url-safe base64) to the applicationServerKey bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type HealState = {
  granted: boolean;
  hasSubscription: boolean;
  /** Subscribed with the key the server signs with now (an old key gets 403 on every send). */
  currentKey: boolean;
  /** The server still holds the row (it deletes endpoints the push service calls gone). */
  saved: boolean;
  /** This account turned push on in this browser (granted permission alone is not intent). */
  mine: boolean;
};

/**
 * drop: the browser holds a subscription the server does not keep for this account, and this
 * account never turned it on here. On a shared device it is the last user's: unsubscribe, never
 * save it for the new user (they turn push on themselves).
 */
export function healPlan(s: HealState): 'ok' | 'resubscribe' | 'drop' {
  if (!s.granted) return 'ok';
  if (!s.hasSubscription) return s.mine ? 'resubscribe' : 'ok';
  if (s.currentKey && s.saved) return 'ok';
  return s.mine ? 'resubscribe' : 'drop';
}
