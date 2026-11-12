import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportError } from '@/lib/errors/report';
import { privateChannel, type RealtimeHost } from './privateChannel';
import { TYPING_EVENTS } from './topics';
import { joinTyping } from './typingChannel';

vi.mock('@/lib/errors/report', () => ({ reportError: vi.fn() }));
vi.mock('./privateChannel', () => ({ privateChannel: vi.fn() }));

type Handler = (msg: { payload?: unknown }) => void;

function setup() {
  const handlers = new Map<string, Handler>();
  const channel = {
    on: vi.fn((_t: string, f: { event: string }, h: Handler) => {
      handlers.set(f.event, h);
      return channel;
    }),
    send: vi.fn().mockResolvedValue('ok'),
  };
  const close = vi.fn();
  let join = () => {};
  vi.mocked(privateChannel).mockImplementation((_h, _t, bind, onJoin) => {
    bind(channel as never);
    join = onJoin ?? join;
    return close;
  });
  const on = vi.fn();
  const link = joinTyping('host' as unknown as RealtimeHost, 'typing-dm:t1', on);
  return { channel, handlers, close, on, link, joined: () => join() };
}

beforeEach(() => vi.mocked(reportError).mockReset());

describe('joinTyping', () => {
  it('joins the private typing topic and passes on start and stop with the profile id only', () => {
    const { handlers, on } = setup();
    expect(privateChannel).toHaveBeenCalledWith('host', 'typing-dm:t1', expect.any(Function), expect.any(Function));
    handlers.get(TYPING_EVENTS.start)!({ payload: { profileId: 'p2', name: 'leak' } });
    handlers.get(TYPING_EVENTS.stop)!({ payload: { profileId: 'p2' } });
    expect(on.mock.calls).toEqual([
      [TYPING_EVENTS.start, 'p2'],
      [TYPING_EVENTS.stop, 'p2'],
    ]);
  });

  it('ignores a payload without a string profile id', () => {
    const { handlers, on } = setup();
    handlers.get(TYPING_EVENTS.start)!({ payload: { profileId: 7 } });
    handlers.get(TYPING_EVENTS.start)!({});
    expect(on).not.toHaveBeenCalled();
  });

  it('sends only after the join, payload = profile id', async () => {
    const { channel, link, joined } = setup();
    link.send(TYPING_EVENTS.start, 'p1');
    expect(channel.send).not.toHaveBeenCalled();
    joined();
    link.send(TYPING_EVENTS.start, 'p1');
    expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'typing', payload: { profileId: 'p1' } });
  });

  it('reports a failed send', async () => {
    const { channel, link, joined } = setup();
    channel.send.mockResolvedValue('error');
    joined();
    link.send(TYPING_EVENTS.stop, 'p1');
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce());
  });

  it('closes the channel', () => {
    const { link, close } = setup();
    link.close();
    expect(close).toHaveBeenCalledOnce();
  });
});
