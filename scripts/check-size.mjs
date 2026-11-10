#!/usr/bin/env node
/** Component over 300 lines = two components. Tests excluded. */
import { countLines, read, rel, report, scan, SRC_ROOTS } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

const MAX = 300;
const files = scan(roots(SRC_ROOTS), ['.tsx']);
const violations = [];
for (const file of files) {
  const lines = countLines(read(file));
  if (lines > MAX) violations.push({ file: rel(file), detail: `${lines} lines (max ${MAX})` });
}

report({
  name: `component over ${MAX} lines`,
  violations,
  scanned: files.length,
  ok: `no component over ${MAX} lines`,
  fix: 'split it — a screen doing two things is two components.',
});
