#!/usr/bin/env node
/**
 * Realtime payload = "stale" hint only. Handler may invalidateQueries, never setQueryData:
 * payload is row-shaped, not query-shaped, so cache would diverge.
 */
import { findLines, read, rel, report, scan, SRC_ROOTS } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

const files = scan(roots(SRC_ROOTS));
const violations = [];
for (const file of files) {
  const text = read(file);
  if (!text.includes('.channel(')) continue;
  const hits = findLines(text, (l) => /\bsetQueryData\b/.test(l) && 'setQueryData in a file that opens a channel');
  for (const hit of hits) violations.push({ file: rel(file), ...hit });
}

report({
  name: 'realtime writes to the cache (invalidate, never set)',
  violations,
  scanned: files.length,
  ok: 'realtime handlers invalidate only',
  fix: 'call invalidateQueries and let the refetch decide the value.',
});
