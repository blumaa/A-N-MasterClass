import { parseMentions } from './markup';

/* Distinct mentioned profile ids embedded as `@[Name](id)` tokens in a body. */
export function mentionIdsFromBody(body: string): string[] {
  const ids = parseMentions(body)
    .filter((seg): seg is Extract<typeof seg, { type: 'mention' }> => seg.type === 'mention')
    .map((seg) => seg.id);
  return Array.from(new Set(ids));
}
