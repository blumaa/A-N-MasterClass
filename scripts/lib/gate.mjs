/**
 * Shared plumbing for `check:*` gates: find files, report, count.
 * Every gate prints how many files it scanned — a pass over 0 files says so.
 * Ported from KSG (G27: copy, diverge freely).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: pathname is percent-encoded; repo path has spaces.
export const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Default scan roots for app code. */
export const SRC_ROOTS = ['src'];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.git', 'coverage']);
const TEST_FILE = /\.(test|spec|stories|fixture)\.[jt]sx?$/;

/** Files under `roots` matching `exts`, minus tests and build output. Missing roots skipped. */
export function scan(roots, exts = ['.ts', '.tsx'], { includeTests = false } = {}) {
  const files = [];
  for (const root of roots) {
    const abs = resolve(REPO_ROOT, root);
    let stats;
    try {
      stats = statSync(abs);
    } catch {
      continue; // root does not exist yet
    }
    if (!stats.isDirectory()) continue;
    walk(abs, files, exts, includeTests);
  }
  return files.sort();
}

function walk(dir, out, exts, includeTests) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out, exts, includeTests);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      if (!includeTests && TEST_FILE.test(entry.name)) continue;
      out.push(join(dir, entry.name));
    }
  }
}

export function read(file) {
  return readFileSync(file, 'utf8');
}

export function rel(file) {
  return relative(REPO_ROOT, file);
}

/** Print result and exit 1 on violations. Pass to stdout, fail to stderr. */
export function report({ name, violations, scanned, ok, fix }) {
  if (violations.length > 0) {
    console.error(`✗ ${name}`);
    for (const v of violations) {
      console.error(`  ${v.file}${v.line ? `:${v.line}` : ''} — ${v.detail}`);
    }
    console.error(`  → ${fix}`);
    process.exit(1);
  }
  console.log(`✓ ${ok} (${scanned} file${scanned === 1 ? '' : 's'} scanned)`);
}

/** Line count as editors count it: trailing newline is not an extra line. */
export function countLines(text) {
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  return body === '' ? 0 : body.split('\n').length;
}

/** Per-line predicate hits, skipping comment-only lines. */
export function findLines(text, predicate) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    const detail = predicate(line);
    if (detail) hits.push({ line: i + 1, detail: typeof detail === 'string' ? detail : line.trim() });
  });
  return hits;
}

/** Run a line predicate over every scanned file and report. */
export function lineGate({ roots, predicate, ...meta }) {
  const files = scan(roots);
  const violations = [];
  for (const file of files) {
    for (const hit of findLines(read(file), predicate)) violations.push({ file: rel(file), ...hit });
  }
  report({ ...meta, violations, scanned: files.length });
}
