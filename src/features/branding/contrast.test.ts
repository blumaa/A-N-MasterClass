import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { contrastFailures } from './contrast';

describe('contrastFailures (MDS contrast contract)', () => {
  it('passes the platform default brand', () => {
    expect(contrastFailures(DEFAULT_BRAND)).toEqual([]);
  });

  it('reports pale ink on a pale page', () => {
    const failures = contrastFailures({ ...DEFAULT_BRAND, ink: '#cccccc' });
    expect(failures.some((f) => f.fg === '--mds-text-primary' && f.bg === '--mds-surface-page')).toBe(true);
    expect(failures[0]).toMatchObject({ scheme: 'light', min: 4.5 });
    expect(failures[0]!.ratio).toBeLessThan(4.5);
  });

  it('reports a pale accent behind white accent text', () => {
    const failures = contrastFailures({ ...DEFAULT_BRAND, accent: '#ffe066' });
    expect(failures.some((f) => f.fg === '--mds-accent-contrast' && f.bg === '--mds-accent')).toBe(true);
  });
});
