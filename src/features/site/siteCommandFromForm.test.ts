import { describe, expect, it } from 'vitest';
import { siteCommandFromForm } from './siteCommandFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('siteCommandFromForm', () => {
  it('derives the slug from the title when blank', () => {
    expect(siteCommandFromForm(form({ op: 'createPage', kind: 'post', title: 'Hello World', slug: '' }))).toEqual({
      ok: true,
      command: { op: 'createPage', kind: 'post', title: 'Hello World', slug: 'hello-world' },
    });
  });

  it('reads page settings; blanks become null, unchecked home is false', () => {
    expect(
      siteCommandFromForm(
        form({ op: 'updatePage', pageId: 'p', title: 'About', slug: 'about', seoTitle: '', seoDescription: 'Hi', legalKind: '' }),
      ),
    ).toEqual({
      ok: true,
      command: {
        op: 'updatePage',
        pageId: 'p',
        title: 'About',
        slug: 'about',
        seoTitle: null,
        seoDescription: 'Hi',
        isHome: false,
        legalKind: null,
      },
    });
  });

  it('collects section fields and item rows in order', () => {
    const r = siteCommandFromForm(
      form({
        op: 'updateSection',
        pageId: 'p',
        sectionId: 's',
        'f.heading': 'FAQ',
        'i.1.question': 'Q2',
        'i.0.question': 'Q1',
        'i.0.answer': 'A1',
      }),
    );
    expect(r).toEqual({
      ok: true,
      command: {
        op: 'updateSection',
        pageId: 'p',
        sectionId: 's',
        fields: { heading: 'FAQ' },
        items: [{ question: 'Q1', answer: 'A1' }, { question: 'Q2' }],
      },
    });
  });

  it('collects nav rows for header and footer', () => {
    const r = siteCommandFromForm(
      form({ op: 'saveNav', 'header.0.label': 'About', 'header.0.href': '/about', 'footer.0.label': '', 'footer.0.href': '' }),
    );
    expect(r).toEqual({
      ok: true,
      command: { op: 'saveNav', header: [{ label: 'About', href: '/about' }], footer: [{ label: '', href: '' }] },
    });
  });

  it('refuses unknown ops and section kinds', () => {
    expect(siteCommandFromForm(form({ op: 'nope' })).ok).toBe(false);
    expect(siteCommandFromForm(form({ op: 'addSection', pageId: 'p', kind: 'marquee' })).ok).toBe(false);
  });
});
