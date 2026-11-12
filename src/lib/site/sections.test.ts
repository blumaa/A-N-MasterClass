import { describe, expect, it } from 'vitest';
import { SECTION_KINDS, SECTION_SPECS, isSafeHref, newSection, parseSections, splitAccent, validateSection as validate, type SiteSection } from './sections';

const SPACE = '11111111-1111-4111-8111-111111111111';
const IMG = `${SPACE}/site/u1-hero.jpg`;
const validateSection = (s: SiteSection, f: Record<string, string>, i: Record<string, string>[]) => validate(s, f, i, SPACE);

describe('isSafeHref', () => {
  it('allows site paths and https only', () => {
    expect(isSafeHref('/programs/x')).toBe(true);
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('//evil.com')).toBe(false);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('http://example.com')).toBe(false);
    expect(isSafeHref('mailto:a@b.c')).toBe(false);
  });
});

describe('SECTION_SPECS', () => {
  it('has a spec per kind', () => {
    expect(Object.keys(SECTION_SPECS).toSorted()).toEqual([...SECTION_KINDS].toSorted());
  });
});

describe('newSection', () => {
  it('starts visible with blank fields from the spec', () => {
    const s = newSection('cta', 's1');
    expect(s).toEqual({ id: 's1', kind: 'cta', hidden: false, fields: { heading: '', body: '', ctaLabel: '', ctaHref: '', tone: '' }, items: [] });
  });
});

describe('validateSection', () => {
  const base = newSection('hero', 'h1');

  it('trims fields and keeps the id, kind and hidden flag', () => {
    const r = validateSection(base, { heading: '  Hi ' }, []);
    expect(r).toEqual({ ok: true, section: { ...base, fields: { ...base.fields, heading: 'Hi' } } });
  });

  it('refuses an unsafe link', () => {
    const r = validateSection(base, { heading: 'Hi', ctaLabel: 'Go', ctaHref: 'javascript:x' }, []);
    expect(r).toEqual({ ok: false, message: 'Button link must start with / or https://.' });
  });

  it('turns a pasted Vimeo link into its id', () => {
    const r = validateSection(newSection('video', 'v1'), { heading: '', vimeoId: 'https://vimeo.com/76979871' }, []);
    expect(r.ok && r.section.fields.vimeoId).toBe('76979871');
    expect(validateSection(newSection('video', 'v1'), { vimeoId: 'nope' }, []).ok).toBe(false);
  });

  it('requires required fields', () => {
    expect(validateSection(newSection('video', 'v1'), { vimeoId: '' }, [])).toEqual({ ok: false, message: 'Vimeo link is required.' });
  });

  it('keeps filled items and drops blank rows', () => {
    const r = validateSection(newSection('faq', 'f1'), { heading: 'FAQ' }, [
      { question: 'Q1', answer: 'A1' },
      { question: ' ', answer: '' },
    ]);
    expect(r.ok && r.section.items).toEqual([{ question: 'Q1', answer: 'A1' }]);
  });

  it('refuses an item missing a required field', () => {
    const r = validateSection(newSection('faq', 'f1'), {}, [{ question: 'Q1', answer: '' }]);
    expect(r).toEqual({ ok: false, message: 'Question 1: Answer is required.' });
  });

  it('ignores fields the spec does not declare', () => {
    const r = validateSection(newSection('text', 't1'), { heading: 'a', body: 'b', evil: 'x' }, []);
    expect(r.ok && r.section.fields).toEqual({ heading: 'a', body: 'b', tone: '' });
  });

  it('accepts only images in the space site folder', () => {
    const it = newSection('imageText', 'x1');
    expect(validateSection(it, { heading: 'a', image: IMG }, []).ok).toBe(true);
    expect(validateSection(it, { heading: 'a', image: 'other/site/u1-a.jpg' }, [])).toEqual({ ok: false, message: 'Image: upload the image again.' });
    expect(validateSection(it, { heading: 'a', image: 'https://evil.test/a.jpg' }, []).ok).toBe(false);
  });

  it('checks images in items too', () => {
    const cards = newSection('cards', 'c1');
    expect(validateSection(cards, {}, [{ image: IMG, title: 'A' }]).ok).toBe(true);
    expect(validateSection(cards, {}, [{ image: 'x/site/a.jpg', title: 'A' }]).ok).toBe(false);
  });

  it('accepts only listed choices (blank = default)', () => {
    expect(validateSection(base, { heading: 'Hi', layout: 'split', tone: 'dark' }, []).ok).toBe(true);
    expect(validateSection(base, { heading: 'Hi', tone: '' }, []).ok).toBe(true);
    expect(validateSection(base, { heading: 'Hi', tone: 'neon' }, [])).toEqual({ ok: false, message: 'Background: choose one of the options.' });
  });
});

describe('every kind', () => {
  it('has a background tone choice', () => {
    for (const kind of SECTION_KINDS) {
      expect(SECTION_SPECS[kind].fields.some((f) => f.name === 'tone' && f.type === 'choice'), kind).toBe(true);
    }
  });

  it('pairs every image field with a description field', () => {
    for (const kind of SECTION_KINDS) {
      const spec = SECTION_SPECS[kind];
      for (const fields of [spec.fields, spec.item?.fields ?? []]) {
        for (const f of fields.filter((x) => x.type === 'image')) {
          expect(fields.some((x) => x.name === `${f.name}Alt`), `${kind}.${f.name}`).toBe(true);
        }
      }
    }
  });
});

describe('splitAccent', () => {
  it('marks *words* as accent parts', () => {
    expect(splitAccent('Find your *calm* today')).toEqual([
      { text: 'Find your ', accent: false },
      { text: 'calm', accent: true },
      { text: ' today', accent: false },
    ]);
  });

  it('leaves text without pairs alone', () => {
    expect(splitAccent('5 * 3')).toEqual([{ text: '5 * 3', accent: false }]);
    expect(splitAccent('')).toEqual([]);
  });
});

describe('parseSections', () => {
  it('accepts stored sections and rejects junk', () => {
    const ok = [newSection('text', 't1')];
    expect(parseSections(ok)).toEqual(ok);
    expect(parseSections([{ ...ok[0], kind: 'nope' }])).toBeNull();
    expect(parseSections('x')).toBeNull();
    expect(parseSections([{ ...ok[0], fields: { heading: 1 } }])).toBeNull();
  });
});
