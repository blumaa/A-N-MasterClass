import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { putFile } from './putFile';

type Listener = (e: { loaded: number; total: number; lengthComputable: boolean }) => void;

class FakeXhr {
  static last: FakeXhr;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: FormData | null = null;
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  upload = { onprogress: null as Listener | null };
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send(body: FormData) {
    this.body = body;
  }
  respond(status: number, text = '') {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
afterEach(() => vi.unstubAllGlobals());

const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' });

describe('putFile', () => {
  it('PUTs the file as form data to the signed URL, without upsert, and reports progress', async () => {
    const progress = vi.fn();
    const done = putFile('https://x.test/upload?token=t', file, progress);
    const xhr = FakeXhr.last;
    expect([xhr.method, xhr.url]).toEqual(['PUT', 'https://x.test/upload?token=t']);
    expect(xhr.headers['x-upsert']).toBe('false');
    expect(xhr.body!.get('cacheControl')).toBe('3600');
    expect((xhr.body!.get('') as File).name).toBe('a.pdf');
    xhr.upload.onprogress!({ loaded: 1, total: 4, lengthComputable: true });
    expect(progress).toHaveBeenCalledWith(25);
    xhr.respond(200, '{"Key":"resources/x"}');
    await expect(done).resolves.toBeUndefined();
  });

  it('rejects with the storage message on an error status', async () => {
    const done = putFile('u', file, vi.fn());
    FakeXhr.last.respond(400, '{"statusCode":"409","error":"Duplicate","message":"The resource already exists"}');
    await expect(done).rejects.toThrow('The resource already exists');
  });

  it('rejects with a plain message when the body is not JSON or the network fails', async () => {
    const bad = putFile('u', file, vi.fn());
    FakeXhr.last.respond(502, '<html>');
    await expect(bad).rejects.toThrow('Upload failed (502).');
    const offline = putFile('u', file, vi.fn());
    FakeXhr.last.onerror!();
    await expect(offline).rejects.toThrow('Upload failed. Check your connection and try again.');
  });
});
