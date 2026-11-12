/**
 * @vitest-environment node
 *
 * Each gate runs against a violating fixture (must exit 1) and a clean one (exit 0).
 * A gate never seen to fail cannot be trusted.
 */
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPTS = resolve(fileURLToPath(new URL('.', import.meta.url)));

let workspace: string | undefined;

afterEach(() => {
  if (workspace) rmSync(workspace, { recursive: true, force: true });
  workspace = undefined;
});

// pnpm exports NODE_PATH; strip it so a fixture is all a gate sees.
const ENV = { ...process.env };
delete ENV.NODE_PATH;

const SPAWN: ExecFileSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  env: ENV,
};

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'masterclass-gate-'));
  workspace = root;
  for (const [path, body] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, 'utf8');
  }
  return root;
}

function run(gate: string, root: string): { code: number; output: string } {
  try {
    const output = execFileSync('node', [join(SCRIPTS, gate), '--root', root], SPAWN);
    return { code: 0, output };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { code: e.status, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('check:deterministic — no optimistic updates', () => {
  it('fails on onMutate', () => {
    const root = fixture({
      'useLike.ts': `export const m = useMutation({\n  onMutate: async () => {},\n});\n`,
    });
    const { code, output } = run('check-deterministic.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('onMutate');
  });

  it('passes on a mutation without it', () => {
    const root = fixture({
      'useLike.ts': `export const m = useMutation({\n  onSuccess: () => {},\n});\n`,
    });
    expect(run('check-deterministic.mjs', root).code).toBe(0);
  });

  it('ignores the word inside a comment', () => {
    const root = fixture({ 'note.ts': `// never use onMutate here\nexport const a = 1;\n` });
    expect(run('check-deterministic.mjs', root).code).toBe(0);
  });
});

describe('check:realtime — socket invalidates, never sets', () => {
  it('fails when setQueryData shares a file with .channel(', () => {
    const root = fixture({
      'notifications.ts': `supabase.channel('n').on('INSERT', (p) => {\n  qc.setQueryData(['n'], p.new);\n});\n`,
    });
    const { code, output } = run('check-realtime.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('setQueryData');
  });

  it('passes when the handler only invalidates', () => {
    const root = fixture({
      'notifications.ts': `supabase.channel('n', { config: { private: true } }).on('INSERT', () => {\n  qc.invalidateQueries({ queryKey: ['n'] });\n});\n`,
    });
    expect(run('check-realtime.mjs', root).code).toBe(0);
  });

  it('allows setQueryData in a file with no channel', () => {
    const root = fixture({ 'cache.ts': `qc.setQueryData(['a'], 1);\n` });
    expect(run('check-realtime.mjs', root).code).toBe(0);
  });

  it('fails on postgres_changes (row data, deletes skip RLS)', () => {
    const root = fixture({
      'feed.ts': `sb.channel('f', { config: { private: true } }).on('postgres_changes', { event: '*' }, poke);\n`,
    });
    const { code, output } = run('check-realtime.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('postgres_changes');
  });

  it('fails on a channel that is not private', () => {
    const root = fixture({ 'feed.ts': `sb.channel('f').on('broadcast', { event: 'stale' }, poke);\n` });
    const { code, output } = run('check-realtime.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('private');
  });

  it('passes a private broadcast channel', () => {
    const root = fixture({
      'feed.ts': `sb.channel(topic, { config: { private: true } }).on('broadcast', { event: 'stale' }, () => poke());\n`,
    });
    expect(run('check-realtime.mjs', root).code).toBe(0);
  });

  it('fails when a client sends the stale event (data hints are database-only)', () => {
    const root = fixture({ 'typing.ts': `channel.send({ type: 'broadcast', event: LIVE_EVENT, payload: {} });\n` });
    const { code, output } = run('check-realtime.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('stale');
  });

  it('fails on httpSend of the stale event too', () => {
    const root = fixture({ 'typing.ts': `await channel.httpSend('stale', {});\n` });
    expect(run('check-realtime.mjs', root).code).toBe(1);
  });

  it('passes a client send of a typing event', () => {
    const root = fixture({ 'typing.ts': `channel.send({ type: 'broadcast', event: TYPING_EVENT, payload: { profileId } });\n` });
    expect(run('check-realtime.mjs', root).code).toBe(0);
  });
});

describe('check:signing — TTL comes from the constant', () => {
  it('fails on a numeric literal TTL', () => {
    const root = fixture({ 'avatar.ts': `await storage.createSignedUrl(path, 60);\n` });
    const { code, output } = run('check-signing.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('createSignedUrl');
  });

  it('fails on the plural form too', () => {
    const root = fixture({ 'avatars.ts': `await storage.createSignedUrls(paths, 3600);\n` });
    expect(run('check-signing.mjs', root).code).toBe(1);
  });

  it('passes when the TTL is the named constant', () => {
    const root = fixture({ 'avatar.ts': `await storage.createSignedUrl(path, SIGNED_URL_TTL_S);\n` });
    expect(run('check-signing.mjs', root).code).toBe(0);
  });
});

describe('check:errors — reporter takes an error only', () => {
  it('fails on a second argument', () => {
    const root = fixture({ 'boundary.tsx': `reportError(err, { postId: post.id });\n` });
    const { code, output } = run('check-errors.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('reportError');
  });

  it('passes on a single argument', () => {
    const root = fixture({ 'boundary.tsx': `reportError(err);\n` });
    expect(run('check-errors.mjs', root).code).toBe(0);
  });

  it('passes on a single argument with nested commas', () => {
    const root = fixture({ 'boundary.tsx': `reportError(wrap(err, 1));\n` });
    expect(run('check-errors.mjs', root).code).toBe(0);
  });
});

describe('check:errors — call boundary', () => {
  it('stops at the closing paren of the call', () => {
    const root = fixture({ 'boundary.tsx': `reportError(err); log(a, b);\n` });
    expect(run('check-errors.mjs', root).code).toBe(0);
  });
});

describe('check:size — component max 300 lines', () => {
  it('fails a 301-line component', () => {
    const root = fixture({ 'Big.tsx': `${'const a = 1;\n'.repeat(301)}` });
    const { code, output } = run('check-size.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('Big.tsx');
  });

  it('passes at exactly 300', () => {
    const root = fixture({ 'Ok.tsx': `${'const a = 1;\n'.repeat(300)}` });
    expect(run('check-size.mjs', root).code).toBe(0);
  });

  it('ignores tests', () => {
    const root = fixture({ 'Big.test.tsx': `${'const a = 1;\n'.repeat(400)}` });
    expect(run('check-size.mjs', root).code).toBe(0);
  });
});

describe('test:sql — refuses unguarded finish()', () => {
  it('fails before touching a DB when a file ends with plain finish()', () => {
    const root = fixture({ '000.test.sql': 'begin; select plan(1); select ok(true); select * from finish(); rollback;' });
    const result = run('run-sql-tests.mjs', root);
    expect(result.code).toBe(1);
    expect(result.output).toContain('without `true`');
  });

  it('passes the static check with finish(true), then needs SUPABASE_DB_URL', () => {
    const root = fixture({ '000.test.sql': 'begin; select plan(1); select ok(true); select * from finish(true); rollback;' });
    delete ENV.SUPABASE_DB_URL;
    const result = run('run-sql-tests.mjs', root);
    expect(result.output).not.toContain('without `true`');
    expect(result.output).toContain('SUPABASE_DB_URL is not set');
  });
});

describe('check:tokens — every --mds-* used is declared', () => {
  it('fails on a token neither MDS nor the app declares', () => {
    const root = fixture({ 'a.module.css': `.a {\n  border: 1px solid var(--mds-color-border-subtle, red);\n}\n` });
    const { code, output } = run('check-tokens.mjs', root);
    expect(code).toBe(1);
    expect(output).toContain('--mds-color-border-subtle');
  });

  it('passes on an MDS token', () => {
    const root = fixture({ 'a.module.css': `.a {\n  gap: var(--mds-space-4);\n}\n` });
    expect(run('check-tokens.mjs', root).code).toBe(0);
  });

  it('passes on a token the app declares itself', () => {
    const root = fixture({
      'brand.css': `:root {\n  --mds-border-subtle: #ccc;\n}\n`,
      'a.module.css': `.a {\n  border-color: var(--mds-border-subtle);\n}\n`,
    });
    expect(run('check-tokens.mjs', root).code).toBe(0);
  });
});
