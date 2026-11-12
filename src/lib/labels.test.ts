import { describe, expect, it } from 'vitest';
import { ROLES } from '@/lib/auth/capabilities';
import { PRODUCT_KINDS } from '@/lib/data/types';
import { PUBLISH_STATUSES } from '@/lib/programs/access';
import { PRODUCT_KIND_LABELS, PUBLISH_STATUS_LABELS, ROLE_LABELS } from './labels';

describe('display labels', () => {
  it.each([
    ['publish status', PUBLISH_STATUSES, PUBLISH_STATUS_LABELS],
    ['role', ROLES, ROLE_LABELS],
    ['product kind', PRODUCT_KINDS, PRODUCT_KIND_LABELS],
  ] as const)('has a capitalised label for every %s', (_, keys, labels) => {
    for (const k of keys) expect((labels as Record<string, string>)[k]).toMatch(/^[A-Z]/);
  });
});
