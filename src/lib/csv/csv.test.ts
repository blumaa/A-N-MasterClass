import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes separators, quotes and line breaks; defuses formulas', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=1+1', 'plain']])).toBe(
      'a,b\r\n"x,y","say ""hi"""\r\n"\'=1+1",plain\r\n',
    );
  });
});
