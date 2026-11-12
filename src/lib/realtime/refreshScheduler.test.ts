import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRefreshScheduler, REFRESH_DEBOUNCE_MS } from './refreshScheduler';

let visible = true;
const refresh = vi.fn();
const make = () => createRefreshScheduler({ refresh, isVisible: () => visible });

beforeEach(() => {
  vi.useFakeTimers();
  visible = true;
  refresh.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('createRefreshScheduler', () => {
  it('turns a burst of pokes into one refresh', () => {
    const s = make();
    s.poke();
    s.poke();
    s.poke();
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('refreshes again for a poke after the window', () => {
    const s = make();
    s.poke();
    vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS);
    s.poke();
    vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does no work while hidden, then one refresh when visible', () => {
    const s = make();
    visible = false;
    s.poke();
    s.poke();
    vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS * 10);
    expect(refresh).not.toHaveBeenCalled();
    visible = true;
    s.visible();
    expect(refresh).toHaveBeenCalledOnce();
    s.visible();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('holds a refresh whose window ends while hidden', () => {
    const s = make();
    s.poke();
    visible = false;
    vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS);
    expect(refresh).not.toHaveBeenCalled();
    visible = true;
    s.visible();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('does nothing on visible when nothing changed', () => {
    make().visible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('drops a pending refresh once disposed', () => {
    const s = make();
    s.poke();
    s.dispose();
    vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS);
    expect(refresh).not.toHaveBeenCalled();
  });
});
