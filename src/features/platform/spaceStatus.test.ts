import { describe, expect, it } from 'vitest';
import { SPACE_STATUSES } from '@/lib/data/types';
import { SPACE_STATUS_LABELS } from './spaceStatus';

describe('SPACE_STATUS_LABELS', () => {
  it('has a capitalised label for every status', () => {
    for (const s of SPACE_STATUSES) expect(SPACE_STATUS_LABELS[s]).toMatch(/^[A-Z]/);
  });
});
