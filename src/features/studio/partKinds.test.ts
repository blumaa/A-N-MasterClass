import { describe, expect, it } from 'vitest';
import { PART_KINDS } from '@/lib/data/types';
import { PART_KIND_LABELS } from './partKinds';

describe('PART_KIND_LABELS', () => {
  it('has a capitalised label for every kind', () => {
    for (const k of PART_KINDS) expect(PART_KIND_LABELS[k]).toMatch(/^[A-Z]/);
  });
});
