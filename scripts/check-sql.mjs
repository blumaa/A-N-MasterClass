#!/usr/bin/env node
/**
 * Every SQL suite ends with finish(true). Plain finish() reports failures but exits 0,
 * so a broken suite would pass both runners. Runs in `gates` (pnpm verify) and before each SQL run.
 */
import { report, read, rel, scan } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

const files = scan(roots(['supabase/tests']), ['.test.sql'], { includeTests: true });
const violations = files
  .filter((file) => !/finish\s*\(\s*true\s*\)/.test(read(file)))
  .map((file) => ({ file: rel(file), detail: 'calls finish() without `true`' }));

report({
  name: 'SQL suite failures would not fail the run',
  violations,
  scanned: files.length,
  ok: 'SQL suites end with finish(true)',
  fix: 'end the suite with `select * from finish(true);`',
});
