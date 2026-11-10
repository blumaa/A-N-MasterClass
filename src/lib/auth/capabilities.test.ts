import { describe, expect, it } from 'vitest';
import { CAPABILITIES, ROLES, can, capabilitiesOf } from './capabilities';

describe('capability matrix (G15)', () => {
  it('owner holds every capability', () => {
    expect(capabilitiesOf('owner')).toEqual([...CAPABILITIES]);
  });

  it('admin holds all except payments and api keys', () => {
    const missing = CAPABILITIES.filter((cap) => !can('admin', cap));
    expect(missing).toEqual(['payments.manage', 'api_keys.manage']);
  });

  it('assistant edits content and moderates community', () => {
    expect(can('assistant', 'products.edit')).toBe(true);
    expect(can('assistant', 'site.edit')).toBe(true);
    expect(can('assistant', 'community.moderate')).toBe(true);
    expect(can('assistant', 'customers.manage')).toBe(false);
    expect(can('assistant', 'staff.manage')).toBe(false);
  });

  it('support manages customers and moderates comments only', () => {
    expect(capabilitiesOf('support')).toEqual(['customers.manage', 'comments.moderate']);
  });

  it('every role is a subset of owner', () => {
    for (const role of ROLES) {
      for (const cap of capabilitiesOf(role)) expect(can('owner', cap)).toBe(true);
    }
  });
});
