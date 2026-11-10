import { describe, expect, it } from 'vitest';
import { formatDuration } from './duration';

describe('formatDuration', () => {
  it('writes m:ss under an hour and h:mm:ss from an hour on', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(3_600)).toBe('1:00:00');
    expect(formatDuration(3_725)).toBe('1:02:05');
  });
});
