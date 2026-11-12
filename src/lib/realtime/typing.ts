// Typing indicator rules (Launch 6 item 7). Pure: no clock, no socket.
// Map = typer profile id -> time of their last typing event.

/** Sender sends at most one typing event per window. */
export const TYPING_SEND_MS = 2500;
/** Receiver drops a typer this long after their last event. */
export const TYPING_TTL_MS = 5000;

export type Typers = ReadonlyMap<string, number>;

export function typingLine(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

export function markTyper(typers: Typers, id: string, at: number): Typers {
  return new Map(typers).set(id, at);
}

export function dropTyper(typers: Typers, id: string): Typers {
  if (!typers.has(id)) return typers;
  const next = new Map(typers);
  next.delete(id);
  return next;
}

export function pruneTypers(typers: Typers, now: number): Typers {
  const live = [...typers].filter(([, at]) => now < at + TYPING_TTL_MS);
  return live.length === typers.size ? typers : new Map(live);
}

/** When the next typer expires, or null when nobody types. */
export function nextExpiry(typers: Typers): number | null {
  let first: number | null = null;
  for (const at of typers.values()) if (first === null || at < first) first = at;
  return first === null ? null : first + TYPING_TTL_MS;
}

/** Throttle: `lastSent` null = not typing yet. */
export function shouldSend(lastSent: number | null, now: number): boolean {
  return lastSent === null || now - lastSent >= TYPING_SEND_MS;
}
