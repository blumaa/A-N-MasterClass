// Studio > community > meetups (G14): scheduled event with an external join link, optional
// discussion channel, time zone, and a Vimeo replay added afterwards.
import { Field, Heading, Input, Stack, Text, Textarea } from '@/components/ui/mds';
import type { AccessGroup, Channel, Meetup } from '@/lib/data/types';
import { EventsForm } from './EventsForm';
import { RowSelect } from './fields';
import { TimeFields } from './TimeFields';
import styles from './community.module.css';

const DEFAULT_ZONE = 'UTC';

function Details({ m, channels }: { m?: Meetup; channels: readonly Channel[] }) {
  return (
    <>
      <Field label="Title">
        <Input name="title" defaultValue={m?.title} required />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={m?.description} rows={3} />
      </Field>
      <Field label="Join link (https)">
        <Input type="url" name="location" defaultValue={m?.location} required />
      </Field>
      <RowSelect name="channelId" label="Discussion channel" value={m?.channelId ?? ''} options={channels} none="None" />
      <TimeFields timeZone={m?.timeZone ?? DEFAULT_ZONE} startsAt={m?.startsAt} endsAt={m?.endsAt} />
    </>
  );
}

type Row = Meetup & { rsvpCount: number };
type Props = { communityId: string; groups: readonly AccessGroup[]; channels: readonly Channel[]; meetups: readonly Row[] };

export function MeetupEditor({ communityId, groups, channels, meetups }: Props) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Meetups
      </Heading>
      <Text tone="muted">The join link shows to members 15 minutes before the start.</Text>
      <ul aria-label="Meetups" className={styles.rows}>
        {meetups.map((m) => (
          <li key={m.id} className={styles.channelRow}>
            <Text variant="note">{m.rsvpCount === 1 ? '1 going' : `${m.rsvpCount} going`}</Text>
            <EventsForm fields={{ op: 'updateMeetup', meetupId: m.id }} submit="Save">
              <Details m={m} channels={channels} />
              <Field label="Replay (Vimeo link or id)">
                <Input name="replayVimeoId" defaultValue={m.replayVimeoId ?? ''} />
              </Field>
            </EventsForm>
            <EventsForm
              inline
              variant="danger"
              submit="Delete"
              confirm={`Delete meetup "${m.title}"?`}
              fields={{ op: 'deleteMeetup', meetupId: m.id }}
            />
          </li>
        ))}
      </ul>
      <Heading level={3} variant="label">
        New meetup
      </Heading>
      <EventsForm fields={{ op: 'createMeetup', communityId }} submit="Add meetup">
        <RowSelect name="accessGroupId" label="Access group" value={groups[0]?.id ?? ''} options={groups} />
        <Details channels={channels} />
      </EventsForm>
    </Stack>
  );
}
