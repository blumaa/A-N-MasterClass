// iCalendar (RFC 5545) single-event file for "Add to calendar": meetups now, coaching later.
// Times are written in UTC (form 2), so no VTIMEZONE block is needed.
export type IcsEvent = {
  /** Globally unique and stable, so re-importing updates the event instead of duplicating. */
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  /** When the file was made (DTSTAMP). */
  stamp: Date;
};

const LINE_OCTETS = 75;

const utc = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** TEXT escaping (3.3.11): backslash, semicolon, comma, newline. */
const text = (s: string): string =>
  s.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n');

/** Folding (3.1): at most 75 octets per line, continuation lines start with one space. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = '';
  for (const ch of line) {
    const limit = out.length === 0 ? LINE_OCTETS : LINE_OCTETS - 1;
    if (bytes.encode(current + ch).length > limit) {
      out.push(current);
      current = '';
    }
    current += ch;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function icsFor(e: IcsEvent): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//masterclass//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${utc(e.stamp)}`,
    `DTSTART:${utc(e.startsAt)}`,
    `DTEND:${utc(e.endsAt)}`,
    `SUMMARY:${text(e.title)}`,
    `DESCRIPTION:${text(e.description)}`,
    `LOCATION:${text(e.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(fold)
    .map((l) => l + '\r\n')
    .join('');
}
