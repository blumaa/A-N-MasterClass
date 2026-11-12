#!/usr/bin/env node
// `pnpm test:sql`: runs supabase/tests/*.test.sql via psql against SUPABASE_DB_URL.
// psql, not pg_prove/`supabase test db`: those need Docker locally. finish(true) + ON_ERROR_STOP=1 = non-zero exit on any failure.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath: repo path has spaces.
const rootFlag = process.argv.indexOf('--root');
const TESTS_DIR =
  rootFlag === -1
    ? fileURLToPath(new URL('../supabase/tests/', import.meta.url))
    : process.argv[rootFlag + 1];

let files;
try {
  files = readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.test.sql'))
    .sort();
} catch {
  console.error(`No ${TESTS_DIR} — nothing to run.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`${TESTS_DIR} has no *.test.sql files.`);
  process.exit(1);
}

// Static check first (no DB needed): same gate as `pnpm gates`.
try {
  execFileSync('node', [fileURLToPath(new URL('./check-sql.mjs', import.meta.url)), '--root', TESTS_DIR], {
    stdio: 'inherit',
  });
} catch {
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    'SUPABASE_DB_URL is not set.\n' +
      'Locally it comes from ~/.config/masterclass/supabase.env.\n' +
      'In CI it comes from `supabase status -o env` against the local stack.',
  );
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  process.stdout.write(`\n── supabase/tests/${file}\n`);
  try {
    const out = execFileSync(
      'psql',
      [dbUrl, '--no-psqlrc', '--quiet', '--tuples-only', '--no-align', '-v', 'ON_ERROR_STOP=1', '-f', join(TESTS_DIR, file)],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    process.stdout.write(out);
  } catch (error) {
    failed += 1;
    process.stdout.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${files.length} test file(s) failed.`);
  process.exit(1);
}
console.log(`\n✓ ${files.length} test file(s) passed.`);
