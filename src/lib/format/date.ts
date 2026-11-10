// One date format for public text. en only until the i18n layer takes over (G24).
const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' });

export const formatDate = (d: Date): string => DATE.format(d);

const DATE_TIME = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

/** Chat and DM lines: date plus time (UTC until viewer time zones exist). */
export const formatDateTime = (d: Date): string => DATE_TIME.format(d);

const zoned = new Map<string, Intl.DateTimeFormat>();

/** Meetup times: date plus time in the event's own zone, zone named so nobody misreads it. */
export function formatInZone(d: Date, timeZone: string): string {
  let fmt = zoned.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone });
    zoned.set(timeZone, fmt);
  }
  return `${fmt.format(d)} ${tzName(d, timeZone)}`;
}

const tzName = (d: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ??
  timeZone;
