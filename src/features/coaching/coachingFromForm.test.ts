import { describe, expect, it } from 'vitest';
import { bookingCommandFromForm, coachingCommandFromForm } from './coachingFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const studio = (fields: Record<string, string>) => coachingCommandFromForm(form(fields));
const client = (fields: Record<string, string>) => bookingCommandFromForm(form(fields));

describe('coachingCommandFromForm', () => {
  it('reads a program with a blank link as none', () => {
    expect(
      studio({ op: 'saveProgram', productId: 'p', kind: 'group', sessionMinutes: '90', sessionsIncluded: '1', location: '' }),
    ).toEqual({
      ok: true,
      command: { op: 'saveProgram', productId: 'p', kind: 'group', sessionMinutes: 90, sessionsIncluded: 1, location: null },
    });
  });

  it('reads a product patch and derives a missing slug', () => {
    expect(studio({ op: 'updateProduct', productId: 'p', title: 'Lab', subtitle: '', status: 'published' })).toEqual({
      ok: true,
      command: { op: 'updateProduct', productId: 'p', patch: { title: 'Lab', subtitle: null, status: 'published' } },
    });
    expect(studio({ op: 'createProgram', title: 'Group Lab', slug: '' })).toEqual({
      ok: true,
      command: { op: 'createProgram', title: 'Group Lab', slug: 'group-lab' },
    });
  });

  it('reads schedule settings', () => {
    expect(
      studio({
        op: 'saveSettings',
        timeZone: 'Europe/Berlin',
        bufferBeforeMin: '0',
        bufferAfterMin: '15',
        minNoticeMin: '720',
        windowDays: '14',
        cancelCutoffHours: '24',
      }),
    ).toEqual({
      ok: true,
      command: {
        op: 'saveSettings',
        timeZone: 'Europe/Berlin',
        bufferBeforeMin: 0,
        bufferAfterMin: 15,
        minNoticeMin: 720,
        windowDays: 14,
        cancelCutoffHours: 24,
      },
    });
  });

  it('reads a weekly window from time inputs', () => {
    expect(studio({ op: 'addRule', weekday: '1', start: '09:00', end: '17:30' })).toEqual({
      ok: true,
      command: { op: 'addRule', weekday: 1, startMinute: 540, endMinute: 1050 },
    });
    expect(studio({ op: 'addRule', weekday: '7', start: '09:00', end: '17:00' })).toEqual({ ok: false, message: 'Unknown weekday: 7.' });
  });

  it('reads a date override as hours or a day off', () => {
    expect(studio({ op: 'addOverride', date: '2026-12-24', start: '', end: '' })).toEqual({
      ok: true,
      command: { op: 'addOverride', date: '2026-12-24', startMinute: null, endMinute: null },
    });
    expect(studio({ op: 'addOverride', date: '2026-12-23', start: '10:00', end: '12:00' })).toMatchObject({
      command: { startMinute: 600, endMinute: 720 },
    });
    expect(studio({ op: 'addOverride', date: '24.12.', start: '', end: '' })).toEqual({ ok: false, message: 'Pick a valid date.' });
  });

  it('reads a group session typed in the coach zone', () => {
    expect(
      studio({
        op: 'createSession',
        productId: 'p',
        title: 'Q&A',
        timeZone: 'Europe/Berlin',
        startsAt: '2026-11-12T19:00',
        minutes: '60',
        agenda: '',
      }),
    ).toEqual({
      ok: true,
      command: { op: 'createSession', productId: 'p', title: 'Q&A', startsAt: new Date('2026-11-12T18:00:00Z'), minutes: 60, agenda: '' },
    });
  });

  it('reads session ops', () => {
    expect(studio({ op: 'saveNote', sessionId: 's', body: '' })).toEqual({ ok: true, command: { op: 'saveNote', sessionId: 's', body: '' } });
    expect(studio({ op: 'syncAgain', sessionId: 's' })).toEqual({ ok: true, command: { op: 'syncAgain', sessionId: 's' } });
    expect(studio({ op: 'reschedule', sessionId: 's', timeZone: 'UTC', startsAt: '2026-11-12T09:00' })).toEqual({
      ok: true,
      command: { op: 'reschedule', sessionId: 's', startsAt: new Date('2026-11-12T09:00:00Z') },
    });
  });
});

describe('bookingCommandFromForm', () => {
  it('reads an offered slot', () => {
    expect(client({ op: 'book', productId: 'p', slot: '2026-11-11T08:00:00.000Z', agenda: 'knots' })).toEqual({
      ok: true,
      command: { op: 'book', productId: 'p', startsAt: new Date('2026-11-11T08:00:00Z'), agenda: 'knots' },
    });
    expect(client({ op: 'book', productId: 'p', agenda: '' })).toEqual({ ok: false, message: 'Pick a valid time.' });
  });

  it('reads reschedule and cancel', () => {
    expect(client({ op: 'reschedule', sessionId: 's', slot: '2026-11-11T08:00:00.000Z' })).toMatchObject({
      command: { op: 'reschedule', sessionId: 's' },
    });
    expect(client({ op: 'cancel', sessionId: 's' })).toEqual({ ok: true, command: { op: 'cancel', sessionId: 's' } });
  });
});
