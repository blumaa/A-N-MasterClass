import { describe, expect, it } from 'vitest';
import { docOf, emptyDoc, fromPlainText, isBlank, isDoc, parseDoc } from './doc';

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

describe('isDoc', () => {
  it('accepts a ProseMirror document', () => {
    expect(isDoc(emptyDoc())).toBe(true);
  });

  it.each([null, 'doc', [], { type: 'paragraph' }])('rejects %j', (value) => {
    expect(isDoc(value)).toBe(false);
  });
});

describe('fromPlainText', () => {
  it('makes a paragraph per blank-line block, line breaks kept', () => {
    expect(fromPlainText('One\ntwo\n\nThree')).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'One' }, { type: 'hardBreak' }, { type: 'text', text: 'two' }] },
        para('Three'),
      ],
    });
  });

  it('gives the empty document for blank text', () => {
    expect(fromPlainText('  \n\n ')).toEqual(emptyDoc());
  });
});

describe('docOf', () => {
  it('keeps a stored document', () => {
    const doc = { type: 'doc', content: [para('Hi')] };
    expect(docOf(doc)).toBe(doc);
  });

  it('reads text saved before the editor as paragraphs', () => {
    expect(docOf('Hi')).toEqual({ type: 'doc', content: [para('Hi')] });
  });

  it('is null for nothing', () => {
    expect(docOf(null)).toBeNull();
    expect(docOf(42)).toBeNull();
  });
});

describe('isBlank', () => {
  it('is true for no words', () => {
    expect(isBlank(emptyDoc())).toBe(true);
    expect(isBlank({ type: 'doc', content: [para('  ')] })).toBe(true);
  });

  it('is false once there are words', () => {
    expect(isBlank({ type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [para('x')] }] }] })).toBe(false);
  });
});

describe('parseDoc', () => {
  it('reads the JSON the editor posts', () => {
    const doc = { type: 'doc', content: [para('Hi')] };
    expect(parseDoc(JSON.stringify(doc))).toEqual(doc);
  });

  it('is null for a blank document, so the part clears', () => {
    expect(parseDoc(JSON.stringify(emptyDoc()))).toBeNull();
  });

  it.each(['not json', '"text"', '{"type":"paragraph"}'])('refuses %s', (raw) => {
    expect(() => parseDoc(raw)).toThrow();
  });

  it('refuses a document past the size cap', () => {
    expect(() => parseDoc(JSON.stringify({ type: 'doc', content: [para('x'.repeat(300_000))] }))).toThrow();
  });
});
