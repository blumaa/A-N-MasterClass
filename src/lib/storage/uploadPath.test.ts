import { describe, expect, it } from 'vitest';
import { isProductPath, safeFileName, uploadPath } from './uploadPath';

describe('safeFileName', () => {
  it('keeps letters, digits and the extension, lower case, dashes between words', () => {
    expect(safeFileName('Hip Harness (v2).PDF')).toBe('hip-harness-v2.pdf');
    expect(safeFileName('Über knot.mp3')).toBe('uber-knot.mp3');
    expect(safeFileName('notes')).toBe('notes');
  });

  it('drops folders, dots and anything a storage key should not carry', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\a\\Ep 1.mp3')).toBe('ep-1.mp3');
    expect(safeFileName('.hidden')).toBe('hidden');
  });

  it('falls back to "file" and caps the length', () => {
    expect(safeFileName('???.mp3')).toBe('file.mp3');
    expect(safeFileName('')).toBe('file');
    expect(safeFileName(`${'a'.repeat(300)}.pdf`)).toBe(`${'a'.repeat(80)}.pdf`);
  });
});

describe('uploadPath / isProductPath', () => {
  it('puts the object under <space>/<product>/<id>-<name>', () => {
    expect(uploadPath({ spaceId: 's1', productId: 'p1', id: 'u1', fileName: 'Ep 1.mp3' })).toBe('s1/p1/u1-ep-1.mp3');
  });

  it('accepts only a single object directly under the product folder of that space', () => {
    expect(isProductPath('s1/p1/u1-ep-1.mp3', 's1', 'p1')).toBe(true);
    expect(isProductPath('s2/p1/u1-ep-1.mp3', 's1', 'p1')).toBe(false);
    expect(isProductPath('s1/p2/u1.mp3', 's1', 'p1')).toBe(false);
    expect(isProductPath('s1/p1/', 's1', 'p1')).toBe(false);
    expect(isProductPath('s1/p1/../../s2/p9/x.mp3', 's1', 'p1')).toBe(false);
    expect(isProductPath('pattern-pack/a.pdf', 's1', 'p1')).toBe(false);
  });
});
