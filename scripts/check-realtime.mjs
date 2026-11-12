#!/usr/bin/env node
/**
 * Realtime = "stale" hint only (Launch 6 item 5). In a file that opens a channel:
 * - never setQueryData: payload is row-shaped, not query-shaped, so cache would diverge.
 * - never postgres_changes: it ships row data, and deletes skip RLS.
 * - channel must be private: join is authorised by RLS on realtime.messages.
 * Any file: a client never sends the stale event. Data hints come from the database only;
 * clients send typing (item 7) on typing topics, which RLS keeps apart from data topics.
 */
import { findLines, read, rel, report, scan, SRC_ROOTS } from './lib/gate.mjs';
import { roots } from './lib/args.mjs';

const files = scan(roots(SRC_ROOTS));
// Opens a Realtime channel = calls .channel( and listens on or joins it (repo.channel(id) is data).
const opensChannel = (text) => text.includes('.channel(') && /\.subscribe\(|\.on\(\s*['"]/.test(text);

// A client send (send / httpSend) naming the stale event, on one line.
const sendsStale = (l) => /(\.send|httpSend)\(/.test(l) && /\bLIVE_EVENT\b|['"]stale['"]/.test(l);

const violations = [];
for (const file of files) {
  const text = read(file);
  for (const hit of findLines(text, (l) => sendsStale(l) && 'client sends the stale event (database only)')) {
    violations.push({ file: rel(file), ...hit });
  }
  if (!opensChannel(text)) continue;
  const hits = findLines(
    text,
    (l) =>
      (/\bsetQueryData\b/.test(l) && 'setQueryData in a file that opens a channel') ||
      (/postgres_changes/.test(l) && 'postgres_changes (row data; deletes skip RLS)'),
  );
  if (!/private:\s*true/.test(text)) {
    hits.push(...findLines(text, (l) => l.includes('.channel(') && 'channel not private (config: { private: true })'));
  }
  for (const hit of hits) violations.push({ file: rel(file), ...hit });
}

report({
  name: 'realtime is a private stale hint (invalidate, never set)',
  violations,
  scanned: files.length,
  ok: 'realtime channels are private, handlers only refresh, clients never send stale',
  fix: 'open private broadcast channels (listenStale) and refetch; never use the payload.',
});
