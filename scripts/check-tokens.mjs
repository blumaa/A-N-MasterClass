#!/usr/bin/env node
/** Every var(--mds-*) the app reads is declared by MDS tokens, by MDS component CSS
 *  (slots like --mds-icon-slot that controls publish), or by the app's own CSS.
 *  A typo'd token silently falls back (or to nothing) — CSS never errors. */
import { join } from 'node:path';
import { REPO_ROOT, read, rel, report, scan, SRC_ROOTS } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

const MDS_TOKENS = join(REPO_ROOT, 'node_modules/@mond-design-system/tokens/src');
const MDS_COMPONENT_CSS = join(REPO_ROOT, 'node_modules/@mond-design-system/react/dist/index.css');
const DECLARE = /(--mds-[a-z0-9-]+)\s*:/g;
const USE = /var\(\s*(--mds-[a-z0-9-]+)/g;

const appFiles = scan(roots(SRC_ROOTS), ['.css', '.ts', '.tsx']);
const declared = new Set();
for (const file of [...scan([MDS_TOKENS], ['.css']), MDS_COMPONENT_CSS, ...appFiles.filter((f) => f.endsWith('.css'))]) {
  for (const m of read(file).matchAll(DECLARE)) declared.add(m[1]);
}

const violations = [];
for (const file of appFiles) {
  read(file)
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(USE)) {
        if (!declared.has(m[1])) violations.push({ file: rel(file), line: i + 1, detail: `${m[1]} is not declared` });
      }
    });
}

report({
  name: 'undeclared design token',
  violations,
  scanned: appFiles.length,
  ok: 'every --mds-* token used is declared',
  fix: 'use a token from @mond-design-system/tokens or src/tokens/brand.css.',
});
