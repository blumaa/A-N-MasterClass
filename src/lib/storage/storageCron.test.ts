import { describe, expect, it, vi } from 'vitest';
import { runStorageCron } from './storageCron';

const SECRET = 'a'.repeat(32);

describe('runStorageCron', () => {
  it('runs the cleanup for the bearer secret and reports counts', async () => {
    const cleanup = vi.fn(async () => ({ queued: 2, removed: 5 }));
    const res = await runStorageCron(`Bearer ${SECRET}`, SECRET, cleanup);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ queued: 2, removed: 5 });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses without the secret, or when none is set', async () => {
    const cleanup = vi.fn(async () => ({ queued: 0, removed: 0 }));
    expect((await runStorageCron('Bearer nope', SECRET, cleanup)).status).toBe(401);
    expect((await runStorageCron(null, null, cleanup)).status).toBe(401);
    expect(cleanup).not.toHaveBeenCalled();
  });
});
