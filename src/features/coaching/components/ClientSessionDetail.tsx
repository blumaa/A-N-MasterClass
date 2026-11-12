// One coaching session for the client: time, join link, add to calendar, and move or cancel
// while still before the coach's cutoff. Times in the client's zone, the coach's as secondary.
import { AppLink, ButtonLink } from '@/components/ui/links';
import { Badge, Heading, Inline, Stack, Text } from '@/components/ui/mds';
import { zonedText } from '@/lib/time/zonedText';
import type { ClientSession } from '../api/booking';
import { coachingHref, sessionIcsHref } from '../paths';
import { BookingForm } from './forms';
import { SlotSelect } from './SlotSelect';

type Props = {
  product: { slug: string; title: string };
  session: ClientSession;
  /** The client's zone (viewer zone cookie, else the coach's). */
  viewerZone: string;
  coachZone: string;
  cutoffHours: number;
  reschedule: { slots: Date[]; calendarDown: boolean };
};

function Change({ session: s, viewerZone, coachZone, cutoffHours, reschedule }: Omit<Props, 'product'>) {
  if (!s.changeable) {
    return s.status === 'scheduled' && s.clientId ? (
      <Text tone="muted">{`Sessions can be changed until ${cutoffHours} hours before they start.`}</Text>
    ) : null;
  }
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Move or cancel
      </Heading>
      {reschedule.calendarDown ? (
        <Text role="status" tone="warning">
          The coach&apos;s calendar cannot be checked right now. Try again in a few minutes.
        </Text>
      ) : reschedule.slots.length > 0 ? (
        <BookingForm fields={{ op: 'reschedule', sessionId: s.id }} submit="Move session">
          <SlotSelect slots={reschedule.slots} timeZone={viewerZone} coachZone={coachZone} />
        </BookingForm>
      ) : null}
      <BookingForm inline variant="danger" submit="Cancel session" confirm="Cancel this session?" fields={{ op: 'cancel', sessionId: s.id }} />
    </Stack>
  );
}

export function ClientSessionDetail(props: Props) {
  const { product, session: s, viewerZone, coachZone } = props;
  const scheduled = s.status === 'scheduled';
  const time = zonedText([s.startsAt, s.endsAt], viewerZone, coachZone);
  return (
    <Stack gap="loose">
      <AppLink href={coachingHref(product.slug)}>{`← ${product.title}`}</AppLink>
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {s.title}
        </Heading>
        <Text>{time.local}</Text>
        {time.own ? <Text tone="muted">{`Coach's time: ${time.own}`}</Text> : null}
        {scheduled ? null : <Badge tone="neutral">Cancelled</Badge>}
        {s.agenda ? <Text>{`Agenda: ${s.agenda}`}</Text> : null}
      </Stack>
      {scheduled ? (
        <Inline gap="tight">
          {s.location ? (
            <ButtonLink href={s.location} variant="primary">
              Join session
            </ButtonLink>
          ) : null}
          <ButtonLink href={sessionIcsHref(product.slug, s.id)} variant="secondary">
            Add to calendar
          </ButtonLink>
        </Inline>
      ) : null}
      <Change {...props} />
    </Stack>
  );
}
