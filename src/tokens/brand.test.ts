// @vitest-environment node
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND_INPUTS } from './brandInputs';

/* Both failures are silent: a forgotten semantic token falls through to a mond
   default; an invented one is read by nothing. */

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const brand = readFileSync(join(here, 'brand.css'), 'utf8');
const contract = readFileSync(require.resolve('@mond-design-system/tokens/semantic.css'), 'utf8');

const declared = (css: string) =>
  new Set([...css.matchAll(/(--mds-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));

const scopes = (css: string) => {
  const dark = css.indexOf("[data-theme='dark']");
  return { light: css.slice(0, dark), dark: css.slice(dark) };
};

describe('brand.css against the MDS semantic contract', () => {
  it('re-declares every semantic token in the light block', () => {
    const light = declared(scopes(brand).light);
    const missing = [...declared(contract)].filter((token) => !light.has(token));
    expect(missing).toEqual([]);
  });

  it('names no --mds-* token the contract lacks', () => {
    const known = declared(contract);
    const invented = [...declared(brand)].filter((token) => !known.has(token));
    expect(invented).toEqual([]);
  });

  it('re-points nothing in dark the light block did not declare', () => {
    const { light, dark } = scopes(brand);
    const known = declared(light);
    const orphans = [...declared(dark)].filter((token) => !known.has(token));
    expect(orphans).toEqual([]);
  });

  it('owns exactly the BRAND_INPUTS and mixes ramps from them', () => {
    const inputs = [...brand.matchAll(/(--brand-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(inputs.toSorted()).toEqual(BRAND_INPUTS.map((name) => `--brand-${name}`).toSorted());
    expect(brand.match(/color-mix\(/g)?.length ?? 0).toBeGreaterThan(20);
  });
});
