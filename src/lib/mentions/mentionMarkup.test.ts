import { describe, expect, it } from 'vitest';
import {
  applyDisplayChange,
  detectMentionQuery,
  formatMentionToken,
  getPlainText,
  insertMention,
  mapDisplayToMarkup,
} from './markup';

const tok = (name: string, id: string): string => formatMentionToken(name, id);

describe('getPlainText', () => {
  it('shows @Name for a token, plain text untouched', () => {
    expect(getPlainText(`hi ${tok('Aaron', 'u1')}!`)).toBe('hi @Aaron!');
  });

  it('handles multiple tokens', () => {
    expect(getPlainText(`${tok('Ana', 'a')} vs ${tok('Bo', 'b')}`)).toBe('@Ana vs @Bo');
  });

  it('is identity for plain text', () => {
    expect(getPlainText('just words')).toBe('just words');
  });
});

describe('mapDisplayToMarkup', () => {
  const markup = `hi ${tok('Aaron', 'u1')} x`; // display: "hi @Aaron x"

  it('maps plain text before a mention 1:1', () => {
    expect(mapDisplayToMarkup(markup, 0, 'start')).toBe(0);
    expect(mapDisplayToMarkup(markup, 3, 'start')).toBe(3); // start of @Aaron
  });

  it('snaps a position inside a mention to its markup bounds', () => {
    // display index 5 is inside "@Aaron" (3..9)
    expect(mapDisplayToMarkup(markup, 5, 'start')).toBe(3);
    expect(mapDisplayToMarkup(markup, 5, 'end')).toBe(3 + tok('Aaron', 'u1').length);
  });

  it('maps trailing text after a mention', () => {
    const afterToken = 3 + tok('Aaron', 'u1').length;
    expect(mapDisplayToMarkup(markup, 10, 'end')).toBe(afterToken + 1);
  });
});

describe('applyDisplayChange', () => {
  it('types a character in plain text', () => {
    const prev = `${tok('Ana', 'a')} hi`;
    const res = applyDisplayChange(prev, '@Ana hi!');
    expect(getPlainText(res.value)).toBe('@Ana hi!');
    expect(res.value).toBe(`${tok('Ana', 'a')} hi!`);
    expect(res.caret).toBe(8);
  });

  it('deleting into a mention removes the whole token', () => {
    const prev = `${tok('Aaron', 'u1')} world`; // display "@Aaron world"
    // user backspaces the trailing "n" of @Aaron -> "@Aaro world"
    const res = applyDisplayChange(prev, '@Aaro world');
    expect(res.value).toBe(' world');
    expect(getPlainText(res.value)).toBe(' world');
    expect(res.caret).toBe(0);
  });

  it('leaves an untouched mention intact when editing elsewhere', () => {
    const prev = `hey ${tok('Bo', 'b')}`;
    const res = applyDisplayChange(prev, 'hello @Bo');
    expect(res.value).toBe(`hello ${tok('Bo', 'b')}`);
  });
});

describe('insertMention — display mapping', () => {
  it('replaces the @query fragment with a token + space', () => {
    const display = 'hi @aa';
    const active = detectMentionQuery(display, display.length);
    expect(active).toEqual({ query: 'aa', start: 3 });
    const res = insertMention('hi @aa', active!, display.length, { id: 'u1', name: 'Aaron' });
    expect(res.value).toBe(`hi ${tok('Aaron', 'u1')} `);
    expect(getPlainText(res.value)).toBe('hi @Aaron ');
    expect(res.caret).toBe('hi @Aaron '.length);
  });

  it('inserts after an existing mention without disturbing it', () => {
    const prevMarkup = `${tok('Ana', 'a')} @b`;
    const display = getPlainText(prevMarkup); // "@Ana @b"
    const active = detectMentionQuery(display, display.length);
    expect(active).toEqual({ query: 'b', start: 5 });
    const res = insertMention(prevMarkup, active!, display.length, { id: 'b2', name: 'Bo' });
    expect(res.value).toBe(`${tok('Ana', 'a')} ${tok('Bo', 'b2')} `);
  });
});
