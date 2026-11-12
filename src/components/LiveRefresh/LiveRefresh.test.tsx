import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenStale } from '@/lib/realtime/privateChannel';
import { REFRESH_DEBOUNCE_MS } from '@/lib/realtime/refreshScheduler';
import { LiveRefresh } from './LiveRefresh';
import { LIVE_POLL_MS, PollRefresh } from './PollRefresh';
import { RealtimeRefresh } from './RealtimeRefresh';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/realtime/browserClient', () => ({ browserClient: () => 'client' }));
vi.mock('@/lib/realtime/privateChannel', () => ({ listenStale: vi.fn() }));

const listen = vi.mocked(listenStale);
const closers: ReturnType<typeof vi.fn>[] = [];
let hidden = false;

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  listen.mockReset();
  closers.length = 0;
  listen.mockImplementation(() => {
    const close = vi.fn();
    closers.push(close);
    return close;
  });
  hidden = false;
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => (hidden ? 'hidden' : 'visible'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const stale = (i = 0) => act(() => (listen.mock.calls[i][2] as () => void)());
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const show = () =>
  act(() => {
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });

describe('RealtimeRefresh', () => {
  it('listens on each topic and closes them on unmount', () => {
    const { unmount } = render(<RealtimeRefresh topics={['dm:t1', 'inbox:u1']} />);
    expect(listen.mock.calls.map((c) => c.slice(0, 2))).toEqual([
      ['client', 'dm:t1'],
      ['client', 'inbox:u1'],
    ]);
    unmount();
    expect(closers.every((c) => c.mock.calls.length === 1)).toBe(true);
  });

  it('refreshes once for a burst of stale hints', () => {
    render(<RealtimeRefresh topics={['channel:c1']} />);
    stale();
    stale();
    stale();
    wait(REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('waits while the tab is hidden, then refreshes once', () => {
    render(<RealtimeRefresh topics={['channel:c1']} />);
    hidden = true;
    stale();
    stale();
    wait(REFRESH_DEBOUNCE_MS * 5);
    expect(refresh).not.toHaveBeenCalled();
    show();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('opens nothing without topics', () => {
    render(<RealtimeRefresh topics={[]} />);
    expect(listen).not.toHaveBeenCalled();
  });
});

describe('PollRefresh', () => {
  it('refreshes on the interval while visible', () => {
    render(<PollRefresh />);
    wait(LIVE_POLL_MS + REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('does no refresh while hidden, one when visible again', () => {
    const { unmount } = render(<PollRefresh />);
    hidden = true;
    wait(LIVE_POLL_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
    show();
    expect(refresh).toHaveBeenCalledOnce();
    unmount();
    wait(LIVE_POLL_MS * 3);
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('LiveRefresh', () => {
  it('polls with fake data (no Realtime there)', () => {
    vi.stubEnv('DATA_SOURCE', 'fake');
    render(<LiveRefresh topics={['channel:c1']} />);
    expect(listen).not.toHaveBeenCalled();
    wait(LIVE_POLL_MS + REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('listens on Realtime with Supabase data, no polling', () => {
    vi.stubEnv('DATA_SOURCE', 'supabase');
    render(<LiveRefresh topics={['channel:c1']} />);
    expect(listen).toHaveBeenCalledOnce();
    wait(LIVE_POLL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
  });
});
