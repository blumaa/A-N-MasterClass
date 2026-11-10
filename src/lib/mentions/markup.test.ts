import { describe, expect, it } from 'vitest';
import {
  detectMentionQuery,
  formatMentionToken,
  getPlainText,
  insertMention,
  parseMentions,
} from './markup';

describe('formatMentionToken', () => {
  it('emits the fixed @[Name](id) contract', () => {
    expect(formatMentionToken('Ada Lovelace', 'u1')).toBe('@[Ada Lovelace](u1)');
  });
});

describe('detectMentionQuery', () => {
  it('triggers at start of input', () => {
    expect(detectMentionQuery('@ad', 3)).toEqual({ query: 'ad', start: 0 });
  });

  it('triggers after whitespace', () => {
    const value = 'hi @bo';
    expect(detectMentionQuery(value, value.length)).toEqual({ query: 'bo', start: 3 });
  });

  it('triggers with an empty query the instant @ is typed', () => {
    expect(detectMentionQuery('hi @', 4)).toEqual({ query: '', start: 3 });
  });

  it('does not trigger when @ is glued to a preceding word (emails)', () => {
    expect(detectMentionQuery('mail me@host', 12)).toBeNull();
  });

  it('does not trigger once the query contains whitespace', () => {
    expect(detectMentionQuery('@ada lovelace', 13)).toBeNull();
  });

  it('uses the caret, not the string end', () => {
    expect(detectMentionQuery('@ad more', 3)).toEqual({ query: 'ad', start: 0 });
  });

  it('returns null with no @ before the caret', () => {
    expect(detectMentionQuery('plain text', 5)).toBeNull();
  });
});

describe('insertMention', () => {
  it('replaces the @query fragment with a token plus trailing space and reports the caret', () => {
    const value = 'hi @ad';
    const active = detectMentionQuery(value, value.length)!;
    const out = insertMention(value, active, value.length, { id: 'u1', name: 'Ada' });
    expect(out.value).toBe('hi @[Ada](u1) ');
    // caret is reported in DISPLAY space (the field shows "@Ada", not the token)
    const display = getPlainText(out.value);
    expect(out.caret).toBe(display.length);
    expect(display[out.caret - 1]).toBe(' ');
  });

  it('preserves text after the caret', () => {
    const value = 'hi @ad!';
    const active = detectMentionQuery(value, 6)!; // caret before "!"
    const out = insertMention(value, active, 6, { id: 'u1', name: 'Ada' });
    expect(out.value).toBe('hi @[Ada](u1) !');
    expect(out.caret).toBe('hi @Ada '.length);
  });

  it('round-trips through parseMentions', () => {
    const value = '@a';
    const active = detectMentionQuery(value, 2)!;
    const out = insertMention(value, active, 2, { id: 'u9', name: 'Bo Persson' });
    const segs = parseMentions(out.value);
    expect(segs).toContainEqual({ type: 'mention', id: 'u9', name: 'Bo Persson' });
  });
});

describe('parseMentions', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns a single text segment when there are no tokens', () => {
    expect(parseMentions('just words')).toEqual([{ type: 'text', value: 'just words' }]);
  });

  it('splits text around a token', () => {
    expect(parseMentions('hi @[Ada](u1)!')).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'mention', id: 'u1', name: 'Ada' },
      { type: 'text', value: '!' },
    ]);
  });

  it('handles adjacent tokens with no empty text between them', () => {
    expect(parseMentions('@[A](1)@[B](2)')).toEqual([
      { type: 'mention', id: '1', name: 'A' },
      { type: 'mention', id: '2', name: 'B' },
    ]);
  });

  it('handles tokens at both string boundaries without empty segments', () => {
    expect(parseMentions('@[A](1) and @[B](2)')).toEqual([
      { type: 'mention', id: '1', name: 'A' },
      { type: 'text', value: ' and ' },
      { type: 'mention', id: '2', name: 'B' },
    ]);
  });

  it('leaves lookalike brackets and parens as literal text', () => {
    const body = 'see [note] (aside) and email a@b';
    expect(parseMentions(body)).toEqual([{ type: 'text', value: body }]);
  });

  it('preserves names and ids that contain spaces', () => {
    expect(parseMentions('@[Bo Persson](user-42)')).toEqual([
      { type: 'mention', id: 'user-42', name: 'Bo Persson' },
    ]);
  });

  it('round-trips a formatted token', () => {
    const token = formatMentionToken('Ada Lovelace', 'u1');
    expect(parseMentions(token)).toEqual([{ type: 'mention', id: 'u1', name: 'Ada Lovelace' }]);
  });
});

describe('parseMentions — links', () => {
  it('turns a pasted https url into a link segment', () => {
    expect(parseMentions('book here https://playtomic.io/court/3')).toEqual([
      { type: 'text', value: 'book here ' },
      { type: 'link', href: 'https://playtomic.io/court/3', label: 'https://playtomic.io/court/3' },
    ]);
  });

  it('links a bare www host, keeping the label as it was typed', () => {
    expect(parseMentions('www.padel.de')).toEqual([
      { type: 'link', href: 'https://www.padel.de', label: 'www.padel.de' },
    ]);
  });

  // The scheme allowlist is the XSS boundary, and it lives in the parser rather
  // than at a call site because every renderer of member-authored text shares it.
  it('leaves a javascript: url as literal text', () => {
    const body = 'javascript:alert(1)';
    expect(parseMentions(body)).toEqual([{ type: 'text', value: body }]);
  });

  it('leaves a data: url as literal text', () => {
    const body = 'data:text/html,<script>alert(1)</script>';
    expect(parseMentions(body)).toEqual([{ type: 'text', value: body }]);
  });

  it('leaves an email address as literal text', () => {
    const body = 'write to ada@example.com';
    expect(parseMentions(body)).toEqual([{ type: 'text', value: body }]);
  });

  it('stops at the sentence, not at the end of the line', () => {
    expect(parseMentions('see https://padel.de.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', href: 'https://padel.de', label: 'https://padel.de' },
      { type: 'text', value: '.' },
    ]);
  });

  it('leaves a closing paren outside the link when the url was written inside one', () => {
    expect(parseMentions('(https://padel.de)')).toEqual([
      { type: 'text', value: '(' },
      { type: 'link', href: 'https://padel.de', label: 'https://padel.de' },
      { type: 'text', value: ')' },
    ]);
  });

  // Wikipedia-style addresses carry their own balanced parens, so a trailing
  // `)` is only punctuation when it has no opener inside the match.
  it('keeps balanced parens that belong to the url', () => {
    expect(parseMentions('https://en.wikipedia.org/wiki/Padel_(sport)')).toEqual([
      {
        type: 'link',
        href: 'https://en.wikipedia.org/wiki/Padel_(sport)',
        label: 'https://en.wikipedia.org/wiki/Padel_(sport)',
      },
    ]);
  });

  it('links a url that follows a mention', () => {
    expect(parseMentions('@[Ada](u1) https://padel.de')).toEqual([
      { type: 'mention', id: 'u1', name: 'Ada' },
      { type: 'text', value: ' ' },
      { type: 'link', href: 'https://padel.de', label: 'https://padel.de' },
    ]);
  });

  it('links every url in a body, not just the first', () => {
    expect(parseMentions('https://a.de and https://b.de')).toEqual([
      { type: 'link', href: 'https://a.de', label: 'https://a.de' },
      { type: 'text', value: ' and ' },
      { type: 'link', href: 'https://b.de', label: 'https://b.de' },
    ]);
  });

  it('does not treat a url as a line break', () => {
    expect(parseMentions('one\nhttps://padel.de\ntwo')).toEqual([
      { type: 'text', value: 'one\n' },
      { type: 'link', href: 'https://padel.de', label: 'https://padel.de' },
      { type: 'text', value: '\ntwo' },
    ]);
  });
});
