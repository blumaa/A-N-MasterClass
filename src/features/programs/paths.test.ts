import { expect, it } from 'vitest';
import { partFileHref, programHref, stepHref } from './paths';

it('builds host-relative program and step paths', () => {
  expect(programHref('shibari-101')).toBe('/programs/shibari-101');
  expect(stepHref('shibari-101', 'step-intro')).toBe('/programs/shibari-101/step-intro');
});

it('builds the signed download path of a step part', () => {
  expect(partFileHref('shibari-101', 'step-intro', 'p1')).toBe('/programs/shibari-101/step-intro/files/p1');
});
