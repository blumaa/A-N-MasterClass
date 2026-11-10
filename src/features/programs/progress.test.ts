import { expect, it } from 'vitest';
import { percent } from './progress';

it('rounds and guards empty programs', () => {
  expect(percent(0, 0)).toBe(0);
  expect(percent(1, 3)).toBe(33);
  expect(percent(3, 3)).toBe(100);
});
