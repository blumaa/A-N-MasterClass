import { describe, expect, it } from 'vitest';
import { downloadName, fileType, formatBytes } from './bytes';

describe('formatBytes', () => {
  it('uses decimal units with one decimal under 10', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1_200_000)).toBe('1.2 MB');
    expect(formatBytes(24_000_000)).toBe('24 MB');
    expect(formatBytes(3_500_000_000)).toBe('3.5 GB');
  });
});

describe('fileType / downloadName', () => {
  it('reads the extension of the last path segment', () => {
    expect(fileType('pack/hip.harness.pdf')).toBe('PDF');
    expect(fileType('pack.v2/README')).toBe('FILE');
    expect(fileType('.env')).toBe('FILE');
  });

  it('adds the extension once', () => {
    expect(downloadName('Hip harness', 'p/hip.pdf')).toBe('Hip harness.pdf');
    expect(downloadName('hip.PDF', 'p/hip.pdf')).toBe('hip.PDF');
    expect(downloadName('Notes', 'p/notes')).toBe('Notes');
  });
});
