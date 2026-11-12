import { describe, expect, it, vi } from 'vitest';
import { PENDING_TAP_CACHE, PENDING_TAP_KEY } from './pendingTap';
import { SERVICE_WORKER } from './serviceWorker';

type Handler = (event: Record<string, unknown>) => void;

function boot(clients: unknown[] = []) {
  const handlers: Record<string, Handler> = {};
  const parked: { cache: string; key: string; body: string }[] = [];
  const opened: string[] = [];
  const put = vi.fn(async (key: string, res: Response) => {
    parked.push({ cache: opened.at(-1)!, key, body: await res.text() });
  });
  const self = {
    caches: { open: vi.fn(async (name: string) => (opened.push(name), { put })) } as { open: (name: string) => Promise<unknown> } | undefined,
    location: { origin: 'https://alexander.masterclass.test' },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => clients), openWindow: vi.fn(async () => null) },
    skipWaiting: vi.fn(),
  };
  new Function('self', SERVICE_WORKER)(self);
  const fire = async (type: string, event: Record<string, unknown>) => {
    let done: Promise<unknown> = Promise.resolve();
    handlers[type]!({ ...event, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  return { self, fire, parked };
}

describe('push service worker', () => {
  it('shows title and body, keeping the url on this space host', async () => {
    const { self, fire } = boot();
    await fire('push', { data: { json: () => ({ title: 'Alexander', body: 'Robin commented', url: '/community/c/posts/p1' }) } });
    expect(self.registration.showNotification).toHaveBeenCalledWith('Alexander', {
      body: 'Robin commented',
      data: { url: 'https://alexander.masterclass.test/community/c/posts/p1' },
    });
  });

  it('shows the space icon when the payload has one', async () => {
    const { self, fire } = boot();
    await fire('push', { data: { json: () => ({ title: 't', body: 'b', url: '/', icon: 'https://cdn.test/icon.png' }) } });
    expect(self.registration.showNotification).toHaveBeenCalledWith('t', {
      body: 'b',
      icon: 'https://cdn.test/icon.png',
      data: { url: 'https://alexander.masterclass.test/' },
    });
  });

  it('forces a foreign url onto its own origin', async () => {
    const { self, fire } = boot();
    await fire('push', { data: { json: () => ({ title: 't', body: 'b', url: 'https://evil.test/x?y=1' }) } });
    expect(self.registration.showNotification).toHaveBeenCalledWith('t', { body: 'b', data: { url: 'https://alexander.masterclass.test/x?y=1' } });
  });

  it('survives a payload that is not JSON', async () => {
    const { self, fire } = boot();
    await fire('push', { data: { json: () => { throw new Error('bad'); }, text: () => 'hello' } });
    expect(self.registration.showNotification).toHaveBeenCalledWith('Notification', { body: 'hello', data: { url: 'https://alexander.masterclass.test/' } });
  });

  it('on click focuses an open window and moves it to the url', async () => {
    const win = { focus: vi.fn(async () => win), navigate: vi.fn(async () => win) };
    const { self, fire } = boot([win]);
    const close = vi.fn();
    await fire('notificationclick', { notification: { close, data: { url: 'https://alexander.masterclass.test/notifications' } } });
    expect(close).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith('https://alexander.masterclass.test/notifications');
    expect(win.focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('on click opens a window when none is open', async () => {
    const { self, fire } = boot();
    await fire('notificationclick', { notification: { close: vi.fn(), data: { url: 'https://alexander.masterclass.test/' } } });
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://alexander.masterclass.test/');
  });

  it('parks the tap in Cache Storage before opening anything (iOS cold start)', async () => {
    const order: string[] = [];
    const { self, fire, parked } = boot();
    const open = self.caches!.open;
    self.caches = { open: async (name: string) => (order.push('park'), open(name)) };
    self.clients.matchAll.mockImplementation(async () => (order.push('match'), []));
    await fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/community/c/posts/p1' } } });
    expect(order).toEqual(['park', 'match']);
    expect(parked).toHaveLength(1);
    expect(parked[0]!.cache).toBe(PENDING_TAP_CACHE);
    expect(parked[0]!.key).toBe(PENDING_TAP_KEY);
    expect(JSON.parse(parked[0]!.body)).toEqual({ url: 'https://alexander.masterclass.test/community/c/posts/p1', ts: expect.any(Number) });
  });

  it('tells an open window to route itself (iOS standalone navigate() does nothing)', async () => {
    const win = { focus: vi.fn(async () => win), navigate: vi.fn(async () => win), postMessage: vi.fn() };
    const { fire } = boot([win]);
    await fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/notifications' } } });
    expect(win.postMessage).toHaveBeenCalledWith({ type: 'navigate', url: 'https://alexander.masterclass.test/notifications' });
  });

  it('still opens the tap without Cache Storage or when parking fails', async () => {
    const a = boot();
    a.self.caches = undefined;
    await a.fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/' } } });
    expect(a.self.clients.openWindow).toHaveBeenCalled();
    const b = boot();
    b.self.caches = { open: async () => Promise.reject(new Error('no cache')) };
    await b.fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/' } } });
    expect(b.self.clients.openWindow).toHaveBeenCalled();
  });
});
