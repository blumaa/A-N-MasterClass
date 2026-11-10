import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('makes a url slug from a title', () => {
    expect(slugify('  Shibari 101: Foundations! ')).toBe('shibari-101-foundations');
    expect(slugify('Über Knoten')).toBe('uber-knoten');
  });
});
