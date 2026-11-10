import { describe, expect, it } from 'vitest';
import { formatMentionToken } from './markup';
import { mentionIdsFromBody } from './parse';

describe('mentionIdsFromBody', () => {
  it('returns no ids for plain text', () => {
    expect(mentionIdsFromBody('just a normal post, no tags')).toEqual([]);
  });

  it('extracts the id from a mention token', () => {
    const body = `hey ${formatMentionToken('Ana Diaz', 'p-1')} nice wrap`;
    expect(mentionIdsFromBody(body)).toEqual(['p-1']);
  });

  it('extracts multiple ids in order', () => {
    const body = `${formatMentionToken('Ana', 'p-1')} vs ${formatMentionToken('Bo', 'p-2')}`;
    expect(mentionIdsFromBody(body)).toEqual(['p-1', 'p-2']);
  });

  it('deduplicates a member mentioned twice', () => {
    const body = `${formatMentionToken('Ana', 'p-1')} and again ${formatMentionToken('Ana', 'p-1')}`;
    expect(mentionIdsFromBody(body)).toEqual(['p-1']);
  });
});
