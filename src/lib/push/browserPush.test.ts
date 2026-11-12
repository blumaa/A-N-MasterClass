import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dropPush, heal, leavePush, subscribe, type PushServer } from './browserPush';

const KEY = 'BAAA';
const ON_KEY = 'push-on:v2';

function fakeSub(endpoint = 'https://push.example/1') {
  return {
    endpoint,
    options: { applicationServerKey: null },
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
  };
}

function install(sub: ReturnType<typeof fakeSub> | null, registered = true) {
  const fresh = fakeSub('https://push.example/new');
  const reg = { pushManager: { getSubscription: vi.fn().mockResolvedValue(sub), subscribe: vi.fn().mockResolvedValue(fresh) } };
  const sw = { register: vi.fn(), ready: Promise.resolve(reg), getRegistration: vi.fn().mockResolvedValue(registered ? reg : undefined) };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') });
  return { reg, sw, fresh };
}

function server(saved = false): PushServer & { [k in keyof PushServer]: ReturnType<typeof vi.fn> } {
  return {
    save: vi.fn().mockResolvedValue({ ok: true }),
    forget: vi.fn().mockResolvedValue(undefined),
    isSaved: vi.fn().mockResolvedValue(saved),
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('leavePush (sign-out)', () => {
  it('deletes the server row, unsubscribes the browser and clears the hint, without registering a worker', async () => {
    const sub = fakeSub();
    const { sw } = install(sub);
    localStorage.setItem(ON_KEY, 'p1');
    const s = server();
    await leavePush(s);
    expect(s.forget).toHaveBeenCalledWith(sub.endpoint);
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem(ON_KEY)).toBeNull();
    expect(sw.register).not.toHaveBeenCalled();
  });

  it('does nothing on the server when this host never had a worker', async () => {
    install(null, false);
    const s = server();
    await leavePush(s);
    expect(s.forget).not.toHaveBeenCalled();
  });
});

describe('dropPush (signed-out visitor)', () => {
  it('unsubscribes the browser and keeps the owner hint for that account', async () => {
    const sub = fakeSub();
    install(sub);
    localStorage.setItem(ON_KEY, 'p1');
    await dropPush();
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem(ON_KEY)).toBe('p1');
  });
});

describe('heal', () => {
  it('drops a subscription another account turned on and never saves it for this one', async () => {
    const sub = fakeSub();
    const { reg } = install(sub);
    localStorage.setItem(ON_KEY, 'p1');
    const s = server(false);
    await heal(s, KEY, 'p2');
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
    expect(s.save).not.toHaveBeenCalled();
  });

  it('re-subscribes when this account turned push on and the browser lost it', async () => {
    const { fresh } = install(null);
    localStorage.setItem(ON_KEY, 'p1');
    const s = server(false);
    await heal(s, KEY, 'p1');
    expect(s.save).toHaveBeenCalledWith(fresh.toJSON());
  });

  it('leaves a device alone when another account turned push on and the browser holds nothing', async () => {
    const { reg } = install(null);
    localStorage.setItem(ON_KEY, 'p1');
    await heal(server(false), KEY, 'p2');
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
  });
});

describe('subscribe', () => {
  it('records which account turned push on in this browser', async () => {
    install(null);
    await subscribe(server(), KEY, 'p1');
    expect(localStorage.getItem(ON_KEY)).toBe('p1');
  });
});
