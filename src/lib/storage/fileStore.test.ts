import { describe, expect, it } from 'vitest';
import { createFakeFileStore, SIGNED_URL_TTL_S } from './fileStore';

describe('fake file store', () => {
  it('signs a path with the TTL and an optional download name', async () => {
    const store = createFakeFileStore(() => new Date('2026-11-10T12:00:00Z'));
    const url = new URL(await store.signedUrl('pack/hip harness.pdf', 'Hip harness.pdf'));
    expect(url.pathname).toBe('/resources/pack/hip%20harness.pdf');
    expect(url.searchParams.get('expires')).toBe(String(Date.parse('2026-11-10T12:00:00Z') / 1000 + SIGNED_URL_TTL_S));
    expect(url.searchParams.get('download')).toBe('Hip harness.pdf');
    expect(new URL(await store.signedUrl('a.mp3')).searchParams.has('download')).toBe(false);
  });
});
