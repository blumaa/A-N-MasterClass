// Coaching forms -> commands. Studio posts schedule numbers as whole numbers, weekly windows as
// time inputs, and coach-scheduled times as datetime-local in `timeZone`. Clients post an
// offered slot as the UTC instant the page rendered.
import { field, parser, readClock, readInstant, readIso, readTimeZone, readWhole } from '@/lib/forms/commands';
import { FormError, type FormReader as Reader } from '@/lib/forms/formReader';
import { COACHING_KINDS, PUBLISH_STATUSES } from '@/lib/data/types';
import { slugify } from '@/lib/text/slugify';
import type { BookingCommand } from './api/booking';
import type { CoachingCommand } from './api/studio';

const WEEKDAYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function date(r: Reader): string {
  const v = r.raw('date') ?? '';
  if (!DATE.test(v)) throw new FormError('Pick a valid date.');
  return v;
}

/** Both times blank = unavailable that day. */
function overrideHours(r: Reader) {
  if (!r.raw('start') && !r.raw('end')) return { startMinute: null, endMinute: null };
  return { startMinute: readClock(r, 'start', 'start time'), endMinute: readClock(r, 'end', 'end time') };
}

const STUDIO: Record<CoachingCommand['op'], (r: Reader) => CoachingCommand> = {
  createProgram: (r) => {
    const title = r.required('title');
    return { op: 'createProgram', title, slug: r.raw('slug') || slugify(title) };
  },
  updateProduct: (r) => ({
    op: 'updateProduct',
    productId: r.required('productId'),
    patch: {
      ...field(r, 'title', () => r.required('title')),
      ...field(r, 'subtitle', () => r.raw('subtitle') || null),
      ...field(r, 'status', () => r.oneOf('status', PUBLISH_STATUSES)),
    },
  }),
  saveProgram: (r) => ({
    op: 'saveProgram',
    productId: r.required('productId'),
    kind: r.oneOf('kind', COACHING_KINDS),
    sessionMinutes: readWhole(r, 'sessionMinutes', 'session length'),
    sessionsIncluded: readWhole(r, 'sessionsIncluded', 'sessions included'),
    location: r.raw('location') || null,
  }),
  saveSettings: (r) => ({
    op: 'saveSettings',
    timeZone: readTimeZone(r),
    bufferBeforeMin: readWhole(r, 'bufferBeforeMin', 'buffer before'),
    bufferAfterMin: readWhole(r, 'bufferAfterMin', 'buffer after'),
    minNoticeMin: readWhole(r, 'minNoticeMin', 'minimum notice'),
    windowDays: readWhole(r, 'windowDays', 'booking window'),
    cancelCutoffHours: readWhole(r, 'cancelCutoffHours', 'cancellation cutoff'),
  }),
  addRule: (r) => ({
    op: 'addRule',
    weekday: Number(r.oneOf('weekday', WEEKDAYS)),
    startMinute: readClock(r, 'start', 'start time'),
    endMinute: readClock(r, 'end', 'end time'),
  }),
  deleteRule: (r) => ({ op: 'deleteRule', ruleId: r.required('ruleId') }),
  addOverride: (r) => ({ op: 'addOverride', date: date(r), ...overrideHours(r) }),
  deleteOverride: (r) => ({ op: 'deleteOverride', overrideId: r.required('overrideId') }),
  createSession: (r) => ({
    op: 'createSession',
    productId: r.required('productId'),
    title: r.required('title'),
    startsAt: readInstant(r, 'startsAt', 'start time'),
    minutes: readWhole(r, 'minutes', 'length'),
    agenda: r.raw('agenda') ?? '',
  }),
  reschedule: (r) => ({ op: 'reschedule', sessionId: r.required('sessionId'), startsAt: readInstant(r, 'startsAt', 'start time') }),
  cancel: (r) => ({ op: 'cancel', sessionId: r.required('sessionId') }),
  saveNote: (r) => ({ op: 'saveNote', sessionId: r.required('sessionId'), body: r.raw('body') ?? '' }),
  syncAgain: (r) => ({ op: 'syncAgain', sessionId: r.required('sessionId') }),
};

const slot = (r: Reader): Date => readIso(r, 'slot', 'time');

const BOOKING: Record<BookingCommand['op'], (r: Reader) => BookingCommand> = {
  book: (r) => ({ op: 'book', productId: r.required('productId'), startsAt: slot(r), agenda: r.raw('agenda') ?? '' }),
  reschedule: (r) => ({ op: 'reschedule', sessionId: r.required('sessionId'), startsAt: slot(r) }),
  cancel: (r) => ({ op: 'cancel', sessionId: r.required('sessionId') }),
};

export const coachingCommandFromForm = parser<CoachingCommand>(STUDIO);
export const bookingCommandFromForm = parser<BookingCommand>(BOOKING);
