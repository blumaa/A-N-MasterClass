import { describe, expect, it } from 'vitest';
import type { MentionOption } from './markup';
import { filterMembers, MENTION_RESULT_LIMIT } from './filter';

const M = (id: string, name: string): MentionOption => ({ id, name });

const MEMBERS: MentionOption[] = [
  M('a1', 'Aaron'),
  M('al', 'Alan Turing'),
  M('ad', 'Ada Lovelace'),
  M('bo', 'Bo Persson'),
];

describe('filterMembers', () => {
  it('matches a partial prefix case-insensitively', () => {
    expect(filterMembers(MEMBERS, 'aa').map((m) => m.name)).toEqual(['Aaron']);
  });

  it('matches a substring anywhere in the name, not just the prefix', () => {
    expect(filterMembers(MEMBERS, 'turing').map((m) => m.id)).toEqual(['al']);
  });

  it('is case-insensitive both ways', () => {
    expect(filterMembers(MEMBERS, 'ADA').map((m) => m.id)).toEqual(['ad']);
  });

  it('returns every member (order preserved) for an empty query', () => {
    expect(filterMembers(MEMBERS, '').map((m) => m.id)).toEqual(['a1', 'al', 'ad', 'bo']);
  });

  it('treats a whitespace-only query as empty', () => {
    expect(filterMembers(MEMBERS, '   ').length).toBe(MEMBERS.length);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterMembers(MEMBERS, 'zzz')).toEqual([]);
  });

  it('caps results at MENTION_RESULT_LIMIT', () => {
    const many: MentionOption[] = Array.from({ length: MENTION_RESULT_LIMIT + 5 }, (_, i) =>
      M(`id${i}`, `Member ${i}`),
    );
    expect(filterMembers(many, 'member').length).toBe(MENTION_RESULT_LIMIT);
  });

  it('never mutates the input array', () => {
    const copy = [...MEMBERS];
    filterMembers(MEMBERS, 'a');
    expect(MEMBERS).toEqual(copy);
  });
});
