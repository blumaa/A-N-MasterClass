// One date format for public text. en only until the i18n layer takes over (G24).
const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' });

export const formatDate = (d: Date): string => DATE.format(d);

const DATE_TIME = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

/** Chat and DM lines: date plus time (UTC until viewer time zones exist). */
export const formatDateTime = (d: Date): string => DATE_TIME.format(d);
