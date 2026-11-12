import { describe, expect, it } from 'vitest';
import { dropTyper, markTyper, nextExpiry, pruneTypers, shouldSend, TYPING_SEND_MS, TYPING_TTL_MS, typingLine } from './typing';

describe('typingLine', () => {
  it('says nothing when nobody types', () => {
    expect(typingLine([])).toBe('');
  });

  it('names one or two typers', () => {
    expect(typingLine(['Ann'])).toBe('Ann is typing…');
    expect(typingLine(['Ann', 'Bo'])).toBe('Ann and Bo are typing…');
  });

  it('does not name three or more', () => {
    expect(typingLine(['Ann', 'Bo', 'Cy'])).toBe('Several people are typing…');
  });
});

describe('typer map', () => {
  it('marks, drops and expires typers after the TTL', () => {
    let m = markTyper(new Map(), 'a', 1000);
    m = markTyper(m, 'b', 2000);
    expect([...m.keys()]).toEqual(['a', 'b']);
    expect(nextExpiry(m)).toBe(1000 + TYPING_TTL_MS);
    expect([...pruneTypers(m, 1000 + TYPING_TTL_MS).keys()]).toEqual(['b']);
    expect([...dropTyper(m, 'a').keys()]).toEqual(['b']);
  });

  it('keeps the same map when nothing changes (no re-render)', () => {
    const m = markTyper(new Map(), 'a', 1000);
    expect(pruneTypers(m, 1001)).toBe(m);
    expect(dropTyper(m, 'zz')).toBe(m);
  });

  it('a new event pushes the expiry out', () => {
    const m = markTyper(markTyper(new Map(), 'a', 1000), 'a', 4000);
    expect(nextExpiry(m)).toBe(4000 + TYPING_TTL_MS);
  });

  it('has no expiry when empty', () => {
    expect(nextExpiry(new Map())).toBeNull();
  });
});

describe('shouldSend', () => {
  it('sends the first key press, then at most once per window', () => {
    expect(shouldSend(null, 5000)).toBe(true);
    expect(shouldSend(5000, 5000 + TYPING_SEND_MS - 1)).toBe(false);
    expect(shouldSend(5000, 5000 + TYPING_SEND_MS)).toBe(true);
  });

  it('expires well after the send window, so a steady typer never flickers', () => {
    expect(TYPING_TTL_MS).toBeGreaterThan(TYPING_SEND_MS);
  });
});
