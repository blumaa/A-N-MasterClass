// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { signedRedirect } from './signedRedirect';

describe('signedRedirect', () => {
  it('sends a 302 to the signed URL and forbids caching it', () => {
    const res = signedRedirect('https://files.example.test/resources/a.mp3?token=x');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://files.example.test/resources/a.mp3?token=x');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('is a 404 when access was refused', () => {
    expect(signedRedirect(null).status).toBe(404);
  });
});
