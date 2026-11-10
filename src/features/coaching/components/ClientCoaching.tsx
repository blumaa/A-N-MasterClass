// Client page of a coaching product (Kajabi Coaching + Scheduler): balance, booking with the
// coach's open slots, and the client's upcoming and past sessions.
import { LinkRow } from '@/components/ui/links';
import { Badge, EmptyState, Field, Heading, ListGroup, Stack, Text, Textarea } from '@/components/ui/mds';
import { formatInZone } from '@/lib/format/date';
import type { ClientCoaching as Data, ClientSession } from '../api/booking';
import { sessionHref } from '../paths';
import { BookingForm } from './forms';
import { SlotSelect } from './SlotSelect';

function Sessions({ label, sessions, product, timeZone }: { label: string; sessions: ClientSession[]; product: string; timeZone: string }) {
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
            description={formatInZone(s.startsAt, timeZone)}
            trailing={s.status === 'cancelled' ? <Badge tone="neutral">Cancelled</Badge> : undefined}
          />
        ))}
      </ListGroup>
    </Stack>
  );
}

function Booking({ data }: { data: Data }) {
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
          <SlotSelect slots={slots} timeZone={settings.timeZone} />
          <Field label="What would you like to work on? (optional)">
            <Textarea name="agenda" rows={3} />
          </Field>
        </BookingForm>
      )}
      <Text tone="muted">{`You can move or cancel a session until ${settings.cancelCutoffHours} hours before it starts.`}</Text>
    </Stack>
  );
}

export function ClientCoaching({ data }: { data: Data }) {
  const { product, hasAccess, isEditor, settings } = data;
  const zone = settings.timeZone;
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {product.title}
        </Heading>
        {product.subtitle ? <Text tone="muted">{product.subtitle}</Text> : null}
      </Stack>
      {hasAccess ? (
        <Booking data={data} />
      ) : (
        <Text>{isEditor ? 'Staff preview: clients with access book here.' : 'You do not have access to this coaching yet.'}</Text>
      )}
      <Sessions label="Upcoming sessions" sessions={data.upcoming} product={product.slug} timeZone={zone} />
      <Sessions label="Past sessions" sessions={data.past} product={product.slug} timeZone={zone} />
    </Stack>
  );
}
