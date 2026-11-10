// One date format for public text. en only until the i18n layer takes over (G24).
const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' });

export const formatDate = (d: Date): string => DATE.format(d);
