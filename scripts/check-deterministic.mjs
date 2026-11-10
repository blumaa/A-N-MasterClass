#!/usr/bin/env node
/**
 * Deterministic writes: UI moves only on the server's answer. `onMutate` = optimistic.
 * Real need = named exemption here, visible in review.
 */
import { lineGate, SRC_ROOTS } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

lineGate({
  roots: roots(SRC_ROOTS),
  predicate: (l) => /\bonMutate\b/.test(l) && 'onMutate — optimistic update',
  name: 'optimistic update found (controls move once, on the server\'s answer)',
  ok: 'no optimistic updates',
  fix: 'show busy for the round trip and render the server response.',
});
