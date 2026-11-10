import type { MentionOption } from './markup';

/* Max people offered in the @mention dropdown. */
export const MENTION_RESULT_LIMIT = 20;

/* Client-side filter over the fetched-once directory (fourteen people, no
   per-keystroke round trips). Case-insensitive substring on the name, capped.
   The server already excluded the caller and anyone out of reach (D46). */
export function filterMembers(members: readonly MentionOption[], query: string): MentionOption[] {
  const q = query.trim().toLowerCase();
  const out: MentionOption[] = [];
  for (const m of members) {
    if (q && !m.name.toLowerCase().includes(q)) continue;
    out.push(m);
    if (out.length >= MENTION_RESULT_LIMIT) break;
  }
  return out;
}
