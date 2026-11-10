import { describe, expect, it } from 'vitest';
import { SECTION_KINDS, SECTION_SPECS, isSafeHref, newSection, parseSections, validateSection } from './sections';

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
    expect(s).toEqual({ id: 's1', kind: 'cta', hidden: false, fields: { heading: '', body: '', ctaLabel: '', ctaHref: '' }, items: [] });
  });
});

describe('validateSection', () => {
  const base = newSection('hero', 'h1');

  it('trims fields and keeps the id, kind and hidden flag', () => {
    const r = validateSection(base, { heading: '  Hi ', subheading: '', ctaLabel: '', ctaHref: '' }, []);
    expect(r).toEqual({ ok: true, section: { ...base, fields: { heading: 'Hi', subheading: '', ctaLabel: '', ctaHref: '' } } });
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
    expect(r.ok && r.section.fields).toEqual({ heading: 'a', body: 'b' });
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
