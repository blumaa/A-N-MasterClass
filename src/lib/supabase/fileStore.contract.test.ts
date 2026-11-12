// Supabase file store against the linked project: upload through a signed upload URL the way the
// browser does (putFile: PUT + FormData, no API key), read it back through a signed URL, remove it.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { adminClient } from './admin';
import { createSupabaseFileStore } from './fileStore';
import { contractEnabled } from './repo/testing/contractSpace';

describe.skipIf(!contractEnabled)('Supabase file store (contract)', () => {
  it('uploads to a signed URL, signs a read, removes the object', async () => {
    const store = createSupabaseFileStore(adminClient());
    const path = `contract-test/${randomUUID()}/hello.txt`;
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt');

    const put = await fetch(await store.uploadUrl(path), { method: 'PUT', headers: { 'x-upsert': 'false' }, body });
    expect(put.status).toBe(200);

    const read = await fetch(await store.signedUrl(path, 'Hello.txt'));
    expect(await read.text()).toBe('hello');
    expect(read.headers.get('content-disposition')).toContain('Hello.txt');

    await store.remove([path]);
    await expect(store.signedUrl(path)).rejects.toThrow();
    await expect(store.remove([path])).resolves.toBeUndefined();
  });

  it('community bucket takes allowed types only', async () => {
    const store = createSupabaseFileStore(adminClient(), 'community');
    const put = async (path: string, type: string) => {
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', new Blob(['x'], { type }), 'x');
      return (await fetch(await store.uploadUrl(path), { method: 'PUT', headers: { 'x-upsert': 'false' }, body })).status;
    };
    const ok = `contract-test/${randomUUID()}/a.txt`;
    expect(await put(ok, 'text/plain')).toBe(200);
    expect(await put(`contract-test/${randomUUID()}/a.exe`, 'application/x-msdownload')).not.toBe(200);
    await store.remove([ok]);
  });
});
