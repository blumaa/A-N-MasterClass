import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { previewVars } from './preview';

describe('previewVars', () => {
  it('resolves every --mds-* alias for the given brand, as literal colours', () => {
    const vars = previewVars({ ...DEFAULT_BRAND, accent: '#a01010' });
    expect(vars['--mds-accent']).toBe('#a01010');
    expect(Object.keys(vars).every((k) => k.startsWith('--mds-'))).toBe(true);
    expect(Object.values(vars).some((v) => v.includes('var('))).toBe(false);
    expect(Object.keys(vars).length).toBeGreaterThan(40);
  });
});
