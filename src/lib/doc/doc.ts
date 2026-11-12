// Rich text as stored: ProseMirror JSON (TipTap's getJSON). No TipTap import here, so the
// server, the repo and the reader share it. Ported from KSG lib/doc (G27: copied, not shared).
import type { Json } from '@/lib/db/database.types';
import { FormError } from '@/lib/forms/formReader';

export type DocAttrs = Record<string, Json | undefined>;
export type DocMark = { type: string; attrs?: DocAttrs };
export type DocNode = { type: string; attrs?: DocAttrs; content?: DocNode[]; marks?: DocMark[]; text?: string };
export type Doc = DocNode & { type: 'doc' };

/** Largest document a form may post, in characters of JSON. */
export const DOC_MAX_CHARS = 200_000;

export function emptyDoc(): Doc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function isDoc(value: unknown): value is Doc {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && (value as { type?: unknown }).type === 'doc';
}

const BREAK = /(?:\r?\n\s*){2,}/;
const LINE = /\r?\n/;

const paragraphOf = (block: string): DocNode => ({
  type: 'paragraph',
  content: block
    .split(LINE)
    .flatMap((line, i): DocNode[] => [...(i === 0 ? [] : [{ type: 'hardBreak' }]), ...(line === '' ? [] : [{ type: 'text', text: line }])]),
});

/** Plain text as a document: a paragraph per blank-line block, single newlines kept as breaks. */
export function fromPlainText(text: string): Doc {
  const blocks = text
    .split(BREAK)
    .map((b) => b.trim())
    .filter((b) => b !== '');
  return blocks.length === 0 ? emptyDoc() : { type: 'doc', content: blocks.map(paragraphOf) };
}

/** A stored value as a document. Strings are text saved before the rich editor. */
export function docOf(value: unknown): Doc | null {
  if (isDoc(value)) return value;
  if (typeof value === 'string') return fromPlainText(value);
  return null;
}

const wordsOf = (node: DocNode): string => (node.text ?? '') + (node.content ?? []).map(wordsOf).join('');

/** No words anywhere in it. */
export function isBlank(doc: Doc): boolean {
  return wordsOf(doc).trim() === '';
}

/** The JSON a rich text field posts. Blank = null (clears the part). Throws FormError. */
export function parseDoc(raw: string): Doc | null {
  if (raw.length > DOC_MAX_CHARS) throw new FormError('That text is too long.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new FormError('The text could not be read. Reload and try again.');
  }
  if (!isDoc(value)) throw new FormError('The text could not be read. Reload and try again.');
  return isBlank(value) ? null : value;
}
