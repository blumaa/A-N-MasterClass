// Studio > one meetup's occurrences (Launch 6 item 8): edit or cancel one, this and following, or
// all (Kajabi scopes). Times are in the meetup's own zone (the coach zone), named in the labels.
import { Badge, Field, Heading, Input, Select, Stack, Text, Textarea } from '@/components/ui/mds';
import { describeRepeat } from '@/lib/calendar/describeRepeat';
import type { Meetup } from '@/lib/data/types';
import { formatInZone } from '@/lib/format/date';
import { utcToZonedInput } from '@/lib/format/zoned';
import type { StudioSession } from '../api/meetupSessions';
import { EventsForm } from './EventsForm';
import styles from './community.module.css';

const SCOPE_LABELS = { this: 'This event only', following: 'This and following events', all: 'All events' } as const;

function ScopeSelect() {
  return (
    <Field label="Apply to">
      <Select name="scope" defaultValue="this">
        {Object.entries(SCOPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function Session({ m, s }: { m: Meetup; s: StudioSession }) {
  const ids = { meetupId: m.id, occurrence: String(s.n), ...(m.repeat ? {} : { scope: 'all' }) };
  const zone = `(${m.timeZone})`;
  return (
    <li className={styles.channelRow}>
      <Text variant="note">
        {formatInZone(s.startsAt, m.timeZone)} · {s.rsvpCount === 1 ? '1 going' : `${s.rsvpCount} going`}
      </Text>
      {s.cancelled ? (
        <Badge tone="neutral">Cancelled</Badge>
      ) : (
        <>
          <EventsForm fields={{ op: 'editOccurrence', timeZone: m.timeZone, ...ids }} submit="Save">
            <Field label="Title">
              <Input name="title" defaultValue={s.title} required />
            </Field>
            <Field label="Description">
              <Textarea name="description" defaultValue={s.description} rows={2} />
            </Field>
            <Field label={`Starts ${zone}`}>
              <Input type="datetime-local" name="startsAt" required defaultValue={utcToZonedInput(s.startsAt, m.timeZone)} />
            </Field>
            <Field label={`Ends ${zone}`}>
              <Input type="datetime-local" name="endsAt" required defaultValue={utcToZonedInput(s.endsAt, m.timeZone)} />
            </Field>
            <Field label="Replay (Vimeo link or id)">
              <Input name="replayVimeoId" defaultValue={s.replayVimeoId ?? ''} />
            </Field>
            {m.repeat ? <ScopeSelect /> : null}
          </EventsForm>
          <EventsForm
            inline
            variant="ghost"
            submit="Cancel event"
            confirm={{ title: 'Cancel this event?', description: 'RSVPs to the cancelled events are removed.', cancelLabel: 'Keep event' }}
            fields={{ op: 'cancelOccurrence', ...ids }}
          >
            {m.repeat ? <ScopeSelect /> : null}
          </EventsForm>
        </>
      )}
    </li>
  );
}

type Props = { meetup: Meetup; past: readonly StudioSession[]; upcoming: readonly StudioSession[] };

export function MeetupSessions({ meetup: m, past, upcoming }: Props) {
  const repeats = describeRepeat(m);
  return (
    <Stack gap="base">
      <Text tone="muted">{repeats ? `Repeats: ${repeats}. ` : ''}Times are in {m.timeZone}.</Text>
      <Heading level={2} variant="subtitle">
        Upcoming
      </Heading>
      {upcoming.length === 0 ? <Text tone="muted">No upcoming events.</Text> : null}
      <ul aria-label="Upcoming events" className={styles.rows}>
        {upcoming.map((s) => (
          <Session key={s.key} m={m} s={s} />
        ))}
      </ul>
      {past.length > 0 ? (
        <>
          <Heading level={2} variant="subtitle">
            Past
          </Heading>
          <ul aria-label="Past events" className={styles.rows}>
            {past.map((s) => (
              <Session key={s.key} m={m} s={s} />
            ))}
          </ul>
        </>
      ) : null}
    </Stack>
  );
}
