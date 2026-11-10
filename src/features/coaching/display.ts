// Pure display helpers for coaching screens (en until the i18n layer takes over, G24).

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Minutes after local midnight as HH:MM (1440 = 24:00, end of day). */
export const clockLabel = (minute: number): string => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

export type SlotDay = { label: string; slots: { iso: string; time: string }[] };

const formats = new Map<string, { day: Intl.DateTimeFormat; time: Intl.DateTimeFormat }>();
const formatsFor = (timeZone: string) => {
  let f = formats.get(timeZone);
  if (!f) {
    f = {
      day: new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone }),
      time: new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }),
    };
    formats.set(timeZone, f);
  }
  return f;
};

/** Open slots grouped by local day in the coach's zone (slots arrive sorted). */
export function slotDays(slots: readonly Date[], timeZone: string): SlotDay[] {
  const { day, time } = formatsFor(timeZone);
  const days: SlotDay[] = [];
  for (const s of slots) {
    const label = day.format(s);
    const entry = { iso: s.toISOString(), time: time.format(s) };
    const last = days.at(-1);
    if (last?.label === label) last.slots.push(entry);
    else days.push({ label, slots: [entry] });
  }
  return days;
}
