// @vitest-environment node
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESERVED_PAGE_SLUGS, checkNav, legalGaps } from './rules';

const spaceRoutes = join(dirname(fileURLToPath(import.meta.url)), '../../app/[space]');

// Static top-level segments under app/[space], looking through (group) folders.
function staticSegments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => (d.name.startsWith('(') ? staticSegments(join(dir, d.name)) : d.name.startsWith('[') ? [] : [d.name]));
}

describe('RESERVED_PAGE_SLUGS', () => {
  it('covers every static route under [space], so no page is shadowed', () => {
    for (const segment of staticSegments(spaceRoutes)) expect(RESERVED_PAGE_SLUGS).toContain(segment);
  });
});

describe('legalGaps (G25)', () => {
  it('lists legal kinds without a published page', () => {
    expect(legalGaps([])).toEqual(['imprint', 'privacy', 'terms']);
    expect(
      legalGaps([
        { legalKind: 'privacy', published: [] },
        { legalKind: 'terms', published: null },
      ]),
    ).toEqual(['imprint', 'terms']);
  });
});

describe('checkNav', () => {
  it('trims, drops blank rows and keeps safe links', () => {
    expect(checkNav([{ label: ' About ', href: '/about' }, { label: '', href: '' }])).toEqual({
      ok: true,
      items: [{ label: 'About', href: '/about' }],
    });
  });

  it('refuses half-filled rows and unsafe links', () => {
    expect(checkNav([{ label: 'About', href: '' }])).toEqual({ ok: false, message: 'Link 1 needs a label and a link.' });
    expect(checkNav([{ label: 'X', href: 'javascript:1' }])).toEqual({
      ok: false,
      message: 'Link 1 must start with / or https://.',
    });
  });

  it('caps the number of links', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ label: `L${i}`, href: '/x' }));
    expect(checkNav(many).ok).toBe(false);
  });
});
