#!/usr/bin/env node
/** reportError takes an error only. Payload = member text leaking into error logs. */
import { lineGate, SRC_ROOTS } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

lineGate({
  roots: roots(SRC_ROOTS),
  predicate: (line) => {
    const m = line.match(/\breportError\s*\((.*)\)/);
    if (!m) return false;
    // Second argument = comma at depth 0 inside the call.
    let depth = 0;
    for (const ch of m[1]) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch) && --depth < 0) return false; // call closed
      else if (ch === ',' && depth === 0) return 'reportError called with a payload';
    }
    return false;
  },
  name: 'error reporter given a payload',
  ok: 'error reporter takes an error only',
  fix: 'pass the error alone — member-authored text must not reach error logs.',
});
