// Short English summary of a meetup repeat ("Weekly on Tue, Thu, 6 times"). Weekdays and the
// monthly ordinal come from the start in the meetup's own zone, like the occurrences.
import { formatDate } from '@/lib/format/date';
import { utcToZonedInput } from '@/lib/format/zoned';
import type { Schedule } from './recurrence';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const ORDINALS = ['1st', '2nd', '3rd', '4th', 'last'] as const;
const UNIT = { daily: ['Daily', 'day'], weekly: ['Weekly', 'week'], monthly: ['Monthly', 'month'] } as const;

export function describeRepeat(s: Schedule): string | null {
  const r = s.repeat;
  if (!r) return null;
  const local = new Date(`${utcToZonedInput(s.startsAt, s.timeZone).slice(0, 10)}T00:00Z`);
  const own = (local.getUTCDay() + 6) % 7;
  const [single, unit] = UNIT[r.freq];
  let text = r.every === 1 ? single : `Every ${r.every} ${unit}s`;
  if (r.freq === 'weekly') text += ` on ${[...new Set([...r.days.map((d) => d - 1), own])].toSorted((a, b) => a - b).map((d) => DAYS[d]).join(', ')}`;
  if (r.freq === 'monthly') text += ` on the ${ORDINALS[Math.ceil(local.getUTCDate() / 7) - 1]} ${LONG_DAYS[own]}`;
  if (r.count !== null) text += `, ${r.count} times`;
  if (r.until !== null) text += `, until ${formatDate(new Date(`${r.until}T00:00Z`))}`;
  return text;
}
