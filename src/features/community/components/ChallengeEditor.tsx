// Studio > community > challenges: create, edit, delete. Times are typed in a chosen zone
// (UTC by default, the zone members see them in) and stored as UTC instants.
import { Field, Heading, Input, Stack, Text, Textarea } from '@/components/ui/mds';
import type { AccessGroup, Challenge } from '@/lib/data/types';
import { EventsForm } from './EventsForm';
import { RowSelect, YesNoSelect } from './fields';
import { TimeFields } from './TimeFields';
import styles from './community.module.css';

const SHOWN_IN = 'UTC';

function Details({ c }: { c?: Challenge }) {
  return (
    <>
      <Field label="Title">
        <Input name="title" defaultValue={c?.title} required />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={c?.description} rows={3} />
      </Field>
      <Field label="Prize">
        <Input name="prize" defaultValue={c?.prize ?? ''} />
      </Field>
      <TimeFields timeZone={SHOWN_IN} startsAt={c?.startsAt} endsAt={c?.endsAt} />
      <YesNoSelect name="showBeforeStart" label="Before it starts" value={c?.showBeforeStart ?? false} yes="Shown" no="Hidden" />
    </>
  );
}

type Row = Challenge & { entryCount: number };
type Props = { communityId: string; groups: readonly AccessGroup[]; challenges: readonly Row[] };

export function ChallengeEditor({ communityId, groups, challenges }: Props) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Challenges
      </Heading>
      <Text tone="muted">Members of the group enter once while it runs. Times show in UTC.</Text>
      <ul aria-label="Challenges" className={styles.rows}>
        {challenges.map((c) => (
          <li key={c.id} className={styles.channelRow}>
            <Text variant="note">{c.entryCount === 1 ? '1 entry' : `${c.entryCount} entries`}</Text>
            <EventsForm fields={{ op: 'updateChallenge', challengeId: c.id }} submit="Save">
              <Details c={c} />
            </EventsForm>
            <EventsForm
              inline
              variant="danger"
              submit="Delete"
              confirm={`Delete challenge "${c.title}" and its entries?`}
              fields={{ op: 'deleteChallenge', challengeId: c.id }}
            />
          </li>
        ))}
      </ul>
      <Heading level={3} variant="label">
        New challenge
      </Heading>
      <EventsForm fields={{ op: 'createChallenge', communityId }} submit="Add challenge">
        <RowSelect name="accessGroupId" label="Access group" value={groups[0]?.id ?? ''} options={groups} />
        <Details />
      </EventsForm>
    </Stack>
  );
}
