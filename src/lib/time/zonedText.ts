// Viewer-facing time: the viewer's zone first, the event's own zone (coach, meetup) as secondary
// text when it reads differently. Unknown viewer zone (no cookie yet): the own zone only.
import { formatInZone } from '@/lib/format/date';

export type ZonedText = { local: string; own: string | null };

/** One time, or a range when given start and end. */
export function zonedText(times: readonly Date[], viewerZone: string | null, ownZone: string): ZonedText {
  const text = (zone: string) => times.map((d) => formatInZone(d, zone)).join(' – ');
  const own = text(ownZone);
  const local = viewerZone ? text(viewerZone) : own;
  return { local, own: own === local ? null : own };
}
