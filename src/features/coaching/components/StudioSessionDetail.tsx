// Studio > Coaching > one session: when and with whom, private coach notes, move or cancel.
// The coach is not bound by the client cutoff (G19); overlaps are still refused.
import { TimeZoneSelect } from '@/components/fields/fields';
import { Badge, Field, Heading, Input, Stack, Text, Textarea } from '@/components/ui/mds';
import { formatInZone } from '@/lib/format/date';
import { utcToZonedInput } from '@/lib/format/zoned';
import type { StudioSessionDetail as Data } from '../api/studio';
import { CoachingForm } from './forms';

export function StudioSessionDetail({ data, timeZone }: { data: Data; timeZone: string }) {
  const { session: s, product, note } = data;
  const scheduled = s.status === 'scheduled';
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {s.title}
        </Heading>
        <Text>{`${product.title} · ${s.clientName ?? 'Group session'}`}</Text>
        <Text>{`${formatInZone(s.startsAt, timeZone)} – ${formatInZone(s.endsAt, timeZone)}`}</Text>
        {scheduled ? null : <Badge tone="neutral">Cancelled</Badge>}
        {s.outOfSync ? (
          <Stack gap="tight">
            <Badge tone="warning">Not synced to Google Calendar</Badge>
            <CoachingForm inline submit="Sync again" fields={{ op: 'syncAgain', sessionId: s.id }} />
          </Stack>
        ) : null}
        {s.agenda ? <Text>{`Agenda: ${s.agenda}`}</Text> : null}
        {s.location ? <Text>{`Join link: ${s.location}`}</Text> : null}
      </Stack>
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Notes
        </Heading>
        <Text tone="muted">Only staff see these notes.</Text>
        <CoachingForm fields={{ op: 'saveNote', sessionId: s.id }} submit="Save notes">
          <Field label="Notes">
            <Textarea name="body" rows={6} defaultValue={note} />
          </Field>
        </CoachingForm>
      </Stack>
      {scheduled ? (
        <Stack gap="base">
          <Heading level={2} variant="subtitle">
            Move or cancel
          </Heading>
          <CoachingForm fields={{ op: 'reschedule', sessionId: s.id }} submit="Move session">
            <Field label="New start">
              <Input type="datetime-local" name="startsAt" defaultValue={utcToZonedInput(s.startsAt, timeZone)} required />
            </Field>
            <TimeZoneSelect value={timeZone} />
          </CoachingForm>
          <CoachingForm inline variant="danger" submit="Cancel session" confirm={{ title: 'Cancel this session?', cancelLabel: 'Keep session' }} fields={{ op: 'cancel', sessionId: s.id }} />
        </Stack>
      ) : null}
    </Stack>
  );
}
