/* A person the mention autocomplete can offer. The consumer supplies these. */
export interface MentionOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/* The fixed wire format for a resolved mention: `@[Name](id)`. Shared with
   `parseMentions` and every renderer — change nowhere or everywhere. */
export function formatMentionToken(name: string, id: string): string {
  return `@[${name}](${id})`;
}

/* An in-progress `@query` at the caret. `start` is the index of the `@`. */
export interface ActiveMention {
  query: string;
  start: number;
}

// `@` at start-of-input or after whitespace, then word chars up to the caret.
// `\w*` allows the empty query (the instant `@` is typed).
const TRIGGER = /(^|\s)@(\w*)$/;

/* Null when the caret is not inside a fresh `@mention` fragment — the single
   source of truth for when the dropdown opens. */
export function detectMentionQuery(value: string, caret: number): ActiveMention | null {
  const before = value.slice(0, caret);
  const m = before.match(TRIGGER);
  if (!m) return null;
  const query = m[2] ?? '';
  return { query, start: caret - query.length - 1 };
}

/* Result of an edit: the new markup and where to put the caret (display space). */
export interface MentionInsertion {
  value: string;
  caret: number;
}

/* A `<textarea>` can only show its literal value, so the field shows display
   text (`@Name`) and keeps `@[Name](id)` markup as the committed value. These
   pure functions map edits between the two; mentions are ATOMIC — editing
   inside one removes the whole token. */
interface MentionSpan {
  markupStart: number;
  markupEnd: number;
  displayStart: number;
  displayEnd: number;
  id: string;
  name: string;
}

/* The text a mention token shows in the field. */
function mentionDisplay(name: string): string {
  return `@${name}`;
}

/* Locate every token with its markup and display offsets. */
function mentionSpans(markup: string): MentionSpan[] {
  const spans: MentionSpan[] = [];
  let markupLast = 0;
  let displayCursor = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(markup)) !== null) {
    displayCursor += m.index - markupLast; // plain text before the token (1:1)
    const display = mentionDisplay(m[1]!);
    spans.push({
      markupStart: m.index,
      markupEnd: m.index + m[0].length,
      displayStart: displayCursor,
      displayEnd: displayCursor + display.length,
      id: m[2]!,
      name: m[1]!,
    });
    displayCursor += display.length;
    markupLast = m.index + m[0].length;
  }
  return spans;
}

/* The human-readable text shown in the field for a markup body. */
export function getPlainText(markup: string): string {
  let out = '';
  let last = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(markup)) !== null) {
    out += markup.slice(last, m.index) + mentionDisplay(m[1]!);
    last = m.index + m[0].length;
  }
  return out + markup.slice(last);
}

/* Map a display index to the matching markup index. A position strictly inside
   a mention resolves by `mode`: 'start' snaps to the token's opening (a splice
   swallows the whole mention), 'end' snaps past its close. */
export function mapDisplayToMarkup(
  markup: string,
  displayIndex: number,
  mode: 'start' | 'end',
): number {
  const spans = mentionSpans(markup);
  for (const s of spans) {
    if (displayIndex <= s.displayStart) {
      return s.markupStart - (s.displayStart - displayIndex);
    }
    if (displayIndex < s.displayEnd) {
      return mode === 'start' ? s.markupStart : s.markupEnd;
    }
    if (displayIndex === s.displayEnd) {
      return s.markupEnd;
    }
  }
  const last = spans[spans.length - 1];
  return last ? last.markupEnd + (displayIndex - last.displayEnd) : displayIndex;
}

/* Minimal prefix/suffix diff — correct for any single contiguous edit (typing,
   paste, range delete). Editing into a token deletes it whole. */
export function applyDisplayChange(prevMarkup: string, nextDisplay: string): MentionInsertion {
  const prevDisplay = getPlainText(prevMarkup);

  let start = 0;
  const maxPrefix = Math.min(prevDisplay.length, nextDisplay.length);
  while (start < maxPrefix && prevDisplay[start] === nextDisplay[start]) start++;

  let prevEnd = prevDisplay.length;
  let nextEnd = nextDisplay.length;
  while (prevEnd > start && nextEnd > start && prevDisplay[prevEnd - 1] === nextDisplay[nextEnd - 1]) {
    prevEnd--;
    nextEnd--;
  }

  const inserted = nextDisplay.slice(start, nextEnd);
  const markupStart = mapDisplayToMarkup(prevMarkup, start, 'start');
  const markupEnd = mapDisplayToMarkup(prevMarkup, prevEnd, 'end');
  const pre = prevMarkup.slice(0, markupStart);
  const nextMarkup = pre + inserted + prevMarkup.slice(markupEnd);
  return { value: nextMarkup, caret: getPlainText(pre).length + inserted.length };
}

/* Replace the active `@query` fragment with a resolved token plus a trailing
   space; the caret lands after the space, in display space. */
export function insertMention(
  markup: string,
  active: ActiveMention,
  caretDisplay: number,
  option: MentionOption,
): MentionInsertion {
  const token = formatMentionToken(option.name, option.id);
  const markupStart = mapDisplayToMarkup(markup, active.start, 'start');
  const markupEnd = mapDisplayToMarkup(markup, caretDisplay, 'end');
  const pre = markup.slice(0, markupStart);
  const nextMarkup = `${pre}${token} ${markup.slice(markupEnd)}`;
  const caret = getPlainText(pre).length + mentionDisplay(option.name).length + 1;
  return { value: nextMarkup, caret };
}

/* An ordered piece of a parsed body. */
export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; id: string; name: string }
  | { type: 'link'; href: string; label: string };

// Name has no `]`, id has no `)` — matches exactly what `formatMentionToken`
// emits, so bare `[brackets]` / `(parens)` stay literal text.
const TOKEN = /@\[([^\]]+)\]\(([^)]+)\)/g;

// `http`/`https`/bare `www.` and nothing else. Every renderer of member-authored
// text shares this parser, so the scheme allowlist here IS the XSS boundary —
// `javascript:` and `data:` never become a segment a renderer could put in href.
const URL = /\b(?:https?:\/\/|www\.)[^\s<]+/gi;

// Only an address if something follows the scheme — `https://.` stays text.
const HAS_HOST = /^(?:https?:\/\/|www\.)[a-z0-9]/i;

const SCHEMELESS = /^www\./i;

// Punctuation that ends a sentence rather than an address: `see padel.de.`
const TRAILING = /[.,!?:;'"”’\]}]+$/;

const count = (s: string, char: string) => s.split(char).length - 1;

/* Drop the punctuation a writer put after the url. A closing paren is only
   punctuation when the url itself never opened one, so `/Padel_(sport)`
   survives while `(padel.de)` does not eat the `)`. */
function trimUrlTail(raw: string): string {
  let url = raw;
  for (;;) {
    const stripped = url.replace(TRAILING, '');
    const unbalanced = stripped.endsWith(')') && count(stripped, ')') > count(stripped, '(');
    const next = unbalanced ? stripped.slice(0, -1) : stripped;
    if (next === url) return url;
    url = next;
  }
}

/* Split a run of literal text into text/link segments. */
function linkify(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  URL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL.exec(text)) !== null) {
    const label = trimUrlTail(m[0]);
    if (!HAS_HOST.test(label)) continue;
    if (m.index > last) {
      segments.push({ type: 'text', value: text.slice(last, m.index) });
    }
    const href = SCHEMELESS.test(label) ? `https://${label}` : label;
    segments.push({ type: 'link', href, label });
    last = m.index + label.length;
    URL.lastIndex = last;
  }
  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) });
  }
  return segments;
}

/* Ordered text/mention/link segments. Mentions are matched first, so a token's
   own `(id)` is never linkified; no empty text segments are emitted. */
export function parseMentions(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(body)) !== null) {
    if (m.index > last) {
      segments.push(...linkify(body.slice(last, m.index)));
    }
    segments.push({ type: 'mention', name: m[1]!, id: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    segments.push(...linkify(body.slice(last)));
  }
  return segments;
}
