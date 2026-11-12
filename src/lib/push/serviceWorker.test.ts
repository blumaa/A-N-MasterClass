import { describe, expect, it, vi } from 'vitest';
import { SERVICE_WORKER } from './serviceWorker';

type Handler = (event: Record<string, unknown>) => void;

function boot(clients: unknown[] = []) {
  const handlers: Record<string, Handler> = {};
  const self = {
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
  return { self, fire };
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
});
