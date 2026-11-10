#!/usr/bin/env node
/** Signed-URL TTL = SIGNED_URL_TTL_S constant, reasoned beside cache time. No literals. */
import { lineGate, SRC_ROOTS } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

lineGate({
  roots: roots(SRC_ROOTS),
  predicate: (line) => {
    const m = line.match(/createSignedUrls?\s*\([^)]*?,\s*(\d+)/);
    return m ? `createSignedUrl with a literal TTL of ${m[1]}` : false;
  },
  name: 'signed-URL TTL hardcoded',
  ok: 'signed URLs use SIGNED_URL_TTL_S',
  fix: 'import SIGNED_URL_TTL_S — TTL must be reasoned about beside the cache time.',
});
