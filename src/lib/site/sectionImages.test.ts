import { describe, expect, it } from 'vitest';
import { newSection } from './sections';
import { sectionImages } from './sectionImages';

const url = (p: string) => `https://cdn.test/${p}`;

describe('sectionImages', () => {
  it('maps every image path in fields and items to its URL', () => {
    const hero = { ...newSection('hero', 'h'), fields: { heading: 'Hi', image: 'sp/site/a.jpg' } };
    const cards = { ...newSection('cards', 'c'), items: [{ title: 'A', image: 'sp/site/b.png' }, { title: 'B', image: '' }] };
    const text = { ...newSection('text', 't'), fields: { body: 'sp/site/not-an-image-field.jpg' } };
    expect(sectionImages([hero, cards, text], url)).toEqual({
      'sp/site/a.jpg': 'https://cdn.test/sp/site/a.jpg',
      'sp/site/b.png': 'https://cdn.test/sp/site/b.png',
    });
  });
});
