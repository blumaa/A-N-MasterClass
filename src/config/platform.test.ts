// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readPlatformHost } from './platform';

describe('readPlatformHost', () => {
  it('returns the lowercased host', () => {
    expect(readPlatformHost({ PLATFORM_HOST: 'MasterClass.test' })).toBe('masterclass.test');
  });

  it('throws when unset or blank', () => {
    expect(() => readPlatformHost({})).toThrow(/PLATFORM_HOST/);
    expect(() => readPlatformHost({ PLATFORM_HOST: '  ' })).toThrow(/PLATFORM_HOST/);
  });

  it('throws when it carries a scheme, port or path', () => {
    for (const bad of ['https://x.test', 'x.test:3000', 'x.test/a']) {
      expect(() => readPlatformHost({ PLATFORM_HOST: bad })).toThrow(/PLATFORM_HOST/);
    }
  });
});
