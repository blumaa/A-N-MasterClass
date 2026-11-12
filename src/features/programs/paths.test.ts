import { expect, it } from 'vitest';
import { certificateHref, partFileHref, programHref, stepHref } from './paths';

it('builds host-relative program and step paths', () => {
  expect(programHref('shibari-101')).toBe('/programs/shibari-101');
  expect(stepHref('shibari-101', 'step-intro')).toBe('/programs/shibari-101/step-intro');
});

it('builds the signed download path of a step part', () => {
  expect(partFileHref('shibari-101', 'step-intro', 'p1')).toBe('/programs/shibari-101/step-intro/files/p1');
});

it('builds the certificate download path of a program', () => {
  expect(certificateHref('shibari-101')).toBe('/programs/shibari-101/certificate');
});
