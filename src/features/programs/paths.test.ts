import { expect, it } from 'vitest';
import { programHref, stepHref } from './paths';

it('builds host-relative program and step paths', () => {
  expect(programHref('shibari-101')).toBe('/programs/shibari-101');
  expect(stepHref('shibari-101', 'step-intro')).toBe('/programs/shibari-101/step-intro');
});
