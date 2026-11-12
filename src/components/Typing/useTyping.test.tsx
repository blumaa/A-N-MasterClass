import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TYPING_EVENTS, type TypingEvent } from '@/lib/realtime/topics';
import { TYPING_SEND_MS, TYPING_TTL_MS } from '@/lib/realtime/typing';
import { joinTyping } from '@/lib/realtime/typingChannel';
import type { TypingConfig } from './typingConfig';
import { useTyping } from './useTyping';

vi.mock('@/lib/realtime/browserClient', () => ({ browserClient: () => 'client' }));
vi.mock('@/lib/realtime/typingChannel', () => ({ joinTyping: vi.fn() }));

const send = vi.fn();
const close = vi.fn();
let incoming: (event: TypingEvent, id: string) => void = () => {};

const CONFIG: TypingConfig = {
  topic: 'typing-channel:c1',
  me: 'me',
  people: [
    { id: 'me', name: 'Me' },
    { id: 'a', name: 'Ann' },
    { id: 'b', name: 'Bo' },
    { id: 'c', name: 'Cy' },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  send.mockReset();
  close.mockReset();
  vi.mocked(joinTyping).mockReset();
  vi.mocked(joinTyping).mockImplementation((_h, _t, on) => {
    incoming = on;
    return { send, close };
  });
});
afterEach(() => vi.useRealTimers());

const hear = (event: TypingEvent, id: string) => act(() => incoming(event, id));
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useTyping', () => {
  it('does nothing without a config (fake mode, signed out)', () => {
    const { result } = renderHook(() => useTyping(null));
    act(() => result.current.typed());
    expect(joinTyping).not.toHaveBeenCalled();
    expect(result.current.line).toBe('');
  });

  it('joins the topic and names others who type, never the viewer', () => {
    const { result } = renderHook(() => useTyping(CONFIG));
    expect(joinTyping).toHaveBeenCalledWith('client', 'typing-channel:c1', expect.any(Function));
    hear(TYPING_EVENTS.start, 'me');
    expect(result.current.line).toBe('');
    hear(TYPING_EVENTS.start, 'a');
    expect(result.current.line).toBe('Ann is typing…');
    hear(TYPING_EVENTS.start, 'b');
    expect(result.current.line).toBe('Ann and Bo are typing…');
    hear(TYPING_EVENTS.start, 'c');
    expect(result.current.line).toBe('Several people are typing…');
  });

  it('ignores ids the page cannot name', () => {
    const { result } = renderHook(() => useTyping(CONFIG));
    hear(TYPING_EVENTS.start, 'stranger');
    expect(result.current.line).toBe('');
  });

  it('expires a typer after the TTL unless a new event comes', () => {
    const { result } = renderHook(() => useTyping(CONFIG));
    hear(TYPING_EVENTS.start, 'a');
    wait(TYPING_TTL_MS - 1000);
    hear(TYPING_EVENTS.start, 'a');
    wait(TYPING_TTL_MS - 1);
    expect(result.current.line).toBe('Ann is typing…');
    wait(1);
    expect(result.current.line).toBe('');
  });

  it('clears a typer on their stop event', () => {
    const { result } = renderHook(() => useTyping(CONFIG));
    hear(TYPING_EVENTS.start, 'a');
    hear(TYPING_EVENTS.stop, 'a');
    expect(result.current.line).toBe('');
  });

  it('throttles sends to one per window, with the viewer id only', () => {
    const { result } = renderHook(() => useTyping(CONFIG));
    act(() => result.current.typed());
    act(() => result.current.typed());
    expect(send.mock.calls).toEqual([[TYPING_EVENTS.start, 'me']]);
    wait(TYPING_SEND_MS);
    act(() => result.current.typed());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('stop sends one stop event, only after typing', () => {
    const { result } = renderHook(() => useTyping(CONFIG));
    act(() => result.current.stop());
    expect(send).not.toHaveBeenCalled();
    act(() => result.current.typed());
    act(() => result.current.stop());
    act(() => result.current.stop());
    expect(send.mock.calls).toEqual([
      [TYPING_EVENTS.start, 'me'],
      [TYPING_EVENTS.stop, 'me'],
    ]);
    act(() => result.current.typed());
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('on unmount: stops typing, then leaves the topic', () => {
    const { result, unmount } = renderHook(() => useTyping(CONFIG));
    act(() => result.current.typed());
    unmount();
    expect(send).toHaveBeenLastCalledWith(TYPING_EVENTS.stop, 'me');
    expect(close).toHaveBeenCalledOnce();
  });
});
