// Browser half of web push: service worker, PushManager, permission. The server half is passed in
// (Server Actions live in app/), so this module knows nothing about spaces or the repo.
// Ported from kinbaku-study-group lib/push/push.ts. The server row is the truth for "this device
// gets push": the sender deletes endpoints the push service calls gone, the browser keeps them.
import { healPlan, isIos, pushAvailability, urlBase64ToUint8Array, type PushAvailability } from './availability';

export type PushServer = {
  save: (subscription: PushSubscriptionJSON) => Promise<{ ok: true } | { ok: false; message: string }>;
  forget: (endpoint: string) => Promise<void>;
  isSaved: (endpoint: string) => Promise<boolean>;
};

/** Served per space host by app/[space]/push-sw.js/route.ts. */
const WORKER_URL = '/push-sw.js';
const ON_KEY = 'push-on:v1';

export function currentAvailability(): PushAvailability {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return pushAvailability({
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    ios: isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    standalone,
    permission: 'Notification' in window ? Notification.permission : 'default',
  });
}

// Storage throws in some private modes; the flag is a hint, so a failed write only loses the hint.
function remember(on: boolean): void {
  try {
    if (on) localStorage.setItem(ON_KEY, '1');
    else localStorage.removeItem(ON_KEY);
  } catch {
    // No storage: heal cannot tell that push was on here, the switch still works.
  }
}
function wasOn(): boolean {
  try {
    return localStorage.getItem(ON_KEY) !== null;
  } catch {
    return false;
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(WORKER_URL);
  return navigator.serviceWorker.ready;
}

function hasKey(sub: PushSubscription, publicKey: string): boolean {
  const key = sub.options.applicationServerKey;
  if (!key) return false;
  const have = new Uint8Array(key);
  const want = urlBase64ToUint8Array(publicKey);
  return have.length === want.length && have.every((b, i) => b === want[i]);
}

const fresh = (reg: ServiceWorkerRegistration, publicKey: string) =>
  reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });

/** Ask permission, subscribe, save. Throws an Error that says why, for the switch to show. */
export async function subscribe(server: PushServer, publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site in your browser settings.');
  const reg = await registration();
  // A subscription the server dropped, or one made with an old key, would only fail again.
  const existing = await reg.pushManager.getSubscription();
  if (existing && (!hasKey(existing, publicKey) || !(await server.isSaved(existing.endpoint)))) {
    await server.forget(existing.endpoint);
    await existing.unsubscribe();
  }
  let sub: PushSubscription;
  try {
    sub = await fresh(reg, publicKey);
  } catch (error) {
    // Chrome refuses while an old subscription is still tearing down: drop it and retry once.
    if (!(error instanceof DOMException) || error.name !== 'InvalidStateError') throw error;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    sub = await fresh(reg, publicKey);
  }
  const saved = await server.save(sub.toJSON());
  if (!saved.ok) throw new Error(saved.message);
  remember(true);
}

export async function unsubscribe(server: PushServer): Promise<void> {
  remember(false);
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await server.forget(sub.endpoint);
  await sub.unsubscribe();
}

/** This device gets push: browser subscription with the current key, and the server row. */
export async function isSubscribed(server: PushServer, publicKey: string): Promise<boolean> {
  const sub = await (await registration()).pushManager.getSubscription();
  return sub !== null && hasKey(sub, publicKey) && server.isSaved(sub.endpoint);
}

/** Quiet recovery of a standing yes: re-subscribe when the browser or the server dropped it. */
export async function heal(server: PushServer, publicKey: string): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const sub = await (await registration()).pushManager.getSubscription();
  const currentKey = sub !== null && hasKey(sub, publicKey);
  const plan = healPlan({
    granted: true,
    hasSubscription: sub !== null,
    currentKey,
    saved: currentKey && sub !== null && (await server.isSaved(sub.endpoint)),
    wasOn: wasOn(),
  });
  if (plan === 'resubscribe') await subscribe(server, publicKey);
}
