import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportError } from '@/lib/errors/report';
import { listenStale, privateChannel, type RealtimeHost } from './privateChannel';
import { LIVE_EVENT } from './topics';

vi.mock('@/lib/errors/report', () => ({ reportError: vi.fn() }));

type Status = (status: string, err?: Error) => void;

function fakeHost() {
  const handlers: (() => void)[] = [];
  let onStatus: Status = () => {};
  const channel = {
    on: vi.fn((_type: string, _filter: object, handler: () => void) => {
      handlers.push(handler);
      return channel;
    }),
    subscribe: vi.fn((cb: Status) => {
      onStatus = cb;
      return channel;
    }),
  };
  let resolveAuth: () => void = () => {};
  const host = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
    realtime: { setAuth: vi.fn(() => new Promise<void>((r) => (resolveAuth = r))) },
  };
  return {
    host: host as unknown as RealtimeHost,
    raw: host,
    channel,
    authed: async () => {
      resolveAuth();
      await Promise.resolve();
      await Promise.resolve();
    },
    fire: (payload?: unknown) => handlers.forEach((h) => (h as (p?: unknown) => void)(payload)),
    status: (s: string, err?: Error) => onStatus(s, err),
  };
}

beforeEach(() => vi.mocked(reportError).mockReset());

describe('privateChannel', () => {
  it('opens a private channel, sets auth, then subscribes', async () => {
    const f = fakeHost();
    const bind = vi.fn();
    privateChannel(f.host, 'channel:c1', bind);
    expect(f.raw.channel).toHaveBeenCalledWith('channel:c1', { config: { private: true } });
    expect(bind).toHaveBeenCalledWith(f.channel);
    expect(f.channel.subscribe).not.toHaveBeenCalled();
    await f.authed();
    expect(f.channel.subscribe).toHaveBeenCalledOnce();
  });

  it('removes the channel on close', async () => {
    const f = fakeHost();
    const close = privateChannel(f.host, 'dm:t1', () => {});
    await f.authed();
    close();
    expect(f.raw.removeChannel).toHaveBeenCalledWith(f.channel);
  });

  it('never subscribes when closed before auth is set', async () => {
    const f = fakeHost();
    const close = privateChannel(f.host, 'dm:t1', () => {});
    close();
    await f.authed();
    expect(f.channel.subscribe).not.toHaveBeenCalled();
    expect(f.raw.removeChannel).toHaveBeenCalledWith(f.channel);
  });

  it('reports a refused or timed out join', async () => {
    const f = fakeHost();
    privateChannel(f.host, 'post:p1', () => {});
    await f.authed();
    const err = new Error('unauthorized');
    f.status('CHANNEL_ERROR', err);
    expect(reportError).toHaveBeenCalledWith(err);
    f.status('TIMED_OUT');
    expect(reportError).toHaveBeenCalledTimes(2);
    f.status('SUBSCRIBED');
    expect(reportError).toHaveBeenCalledTimes(2);
  });
});

describe('listenStale', () => {
  it('listens for the stale broadcast and calls back without the payload', async () => {
    const f = fakeHost();
    const onStale = vi.fn();
    listenStale(f.host, 'inbox:u1', onStale);
    expect(f.channel.on).toHaveBeenCalledWith('broadcast', { event: LIVE_EVENT }, expect.any(Function));
    f.fire({ payload: { secret: 'x' } });
    expect(onStale).toHaveBeenCalledWith();
  });
});
