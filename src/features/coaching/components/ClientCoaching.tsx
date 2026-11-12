// Client page of a coaching product (Kajabi Coaching + Scheduler): balance, booking with the
// coach's open slots, and the client's upcoming and past sessions. Times in the client's zone,
// the coach's zone as secondary.
import { LinkRow } from '@/components/ui/links';
import { Badge, EmptyState, Field, Heading, ListGroup, Stack, Text, Textarea } from '@/components/ui/mds';
import type { ClientCoaching as Data, ClientSession } from '../api/booking';
import { zonedText } from '../display';
import { sessionHref } from '../paths';
import { BookingForm } from './forms';
import { SlotSelect } from './SlotSelect';

type Zones = { viewerZone: string; coachZone: string };

function when(d: Date, { viewerZone, coachZone }: Zones): string {
  const t = zonedText([d], viewerZone, coachZone);
  return t.coach ? `${t.local} · Coach: ${t.coach}` : t.local;
}

function Sessions({ label, sessions, product, zones }: { label: string; sessions: ClientSession[]; product: string; zones: Zones }) {
  if (sessions.length === 0) return null;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        {label}
      </Heading>
      <ListGroup aria-label={label}>
        {sessions.map((s) => (
          <LinkRow
            key={s.id}
            href={sessionHref(product, s.id)}
            title={s.clientId ? s.title : `${s.title} (group)`}
            description={when(s.startsAt, zones)}
            trailing={s.status === 'cancelled' ? <Badge tone="neutral">Cancelled</Badge> : undefined}
          />
        ))}
      </ListGroup>
    </Stack>
  );
}

function Booking({ data, viewerZone }: { data: Data; viewerZone: string }) {
  const { program, remaining, slots, calendarDown, settings, product } = data;
  if (program.kind !== 'one_on_one') return null;
  if (remaining === 0) return <Text>All your sessions are booked.</Text>;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Book a session
      </Heading>
      <Text>{`${remaining} of ${program.sessionsIncluded} sessions left · ${program.sessionMinutes} minutes each.`}</Text>
      {calendarDown ? (
        <Text role="status" tone="warning">
          The coach&apos;s calendar cannot be checked right now. Try again in a few minutes.
        </Text>
      ) : slots.length === 0 ? (
        <EmptyState title="No open times" description="The coach has no free times in the booking window. Check back later." />
      ) : (
        <BookingForm fields={{ op: 'book', productId: product.id }} submit="Book" variant="primary">
          <SlotSelect slots={slots} timeZone={viewerZone} coachZone={settings.timeZone} />
          <Field label="What would you like to work on? (optional)">
            <Textarea name="agenda" rows={3} />
          </Field>
        </BookingForm>
      )}
      <Text tone="muted">{`You can move or cancel a session until ${settings.cancelCutoffHours} hours before it starts.`}</Text>
    </Stack>
  );
}

/** viewerZone: the client's zone (viewer zone cookie, else the coach's). */
export function ClientCoaching({ data, viewerZone }: { data: Data; viewerZone: string }) {
  const { product, hasAccess, isEditor, settings } = data;
  const zones = { viewerZone, coachZone: settings.timeZone };
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {product.title}
        </Heading>
        {product.subtitle ? <Text tone="muted">{product.subtitle}</Text> : null}
      </Stack>
      {hasAccess ? (
        <Booking data={data} viewerZone={viewerZone} />
      ) : (
        <Text>{isEditor ? 'Staff preview: clients with access book here.' : 'You do not have access to this coaching yet.'}</Text>
      )}
      <Sessions label="Upcoming sessions" sessions={data.upcoming} product={product.slug} zones={zones} />
      <Sessions label="Past sessions" sessions={data.past} product={product.slug} zones={zones} />
    </Stack>
  );
}
