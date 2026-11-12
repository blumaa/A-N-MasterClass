import { describe, expect, it } from 'vitest';
import { healPlan, isIos, pushAvailability, urlBase64ToUint8Array, type BrowserPush } from './availability';

const browser = (over: Partial<BrowserPush> = {}): BrowserPush => ({
  serviceWorker: true,
  pushManager: true,
  notification: true,
  ios: false,
  standalone: false,
  permission: 'default',
  ...over,
});

describe('pushAvailability', () => {
  it('is ready on a browser with service worker, PushManager and Notification', () => {
    expect(pushAvailability(browser())).toBe('ready');
  });

  it('asks iOS users to add the app to the home screen first', () => {
    expect(pushAvailability(browser({ ios: true, pushManager: false, notification: false }))).toBe('install');
    expect(pushAvailability(browser({ ios: true, standalone: true }))).toBe('ready');
  });

  it('is unsupported elsewhere without the APIs, and blocked when refused', () => {
    expect(pushAvailability(browser({ pushManager: false }))).toBe('unsupported');
    expect(pushAvailability(browser({ ios: true, standalone: true, pushManager: false }))).toBe('unsupported');
    expect(pushAvailability(browser({ permission: 'denied' }))).toBe('blocked');
  });
});

describe('isIos', () => {
  it('spots iPhone and iPadOS (which reports a Mac with touch)', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes url-safe base64 without padding', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });
});

describe('healPlan', () => {
  const base = { granted: true, hasSubscription: true, currentKey: true, saved: true, wasOn: true };
  it('leaves a healthy or never-enabled device alone', () => {
    expect(healPlan(base)).toBe('ok');
    expect(healPlan({ ...base, hasSubscription: false, wasOn: false })).toBe('ok');
    expect(healPlan({ ...base, granted: false })).toBe('ok');
  });

  it('subscribes again when the server dropped the row, the key changed, or the browser lost it', () => {
    expect(healPlan({ ...base, saved: false })).toBe('resubscribe');
    expect(healPlan({ ...base, currentKey: false })).toBe('resubscribe');
    expect(healPlan({ ...base, hasSubscription: false })).toBe('resubscribe');
  });
});
