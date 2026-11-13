// Studio > Coaching (G18, G19, Kajabi Coaching + Scheduler): coaching products and their
// program settings, the coach's availability (settings, weekly hours, date overrides), the
// Google Calendar connection and upcoming sessions.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { ChoiceSelect, RowSelect, TimeZoneSelect } from '@/components/fields/fields';
import { ProductFields, type ImageSrc } from '@/components/ProductFields/ProductFields';
import { LinkRow } from '@/components/ui/links';
import { Badge, EmptyState, Field, Heading, Input, ListGroup, Select, Stack, Text, Textarea } from '@/components/ui/mds';
import { COACHING_KINDS, type CoachingKind } from '@/lib/data/types';
import { formatInZone } from '@/lib/format/date';
import type { ConnectOutcome } from '../api/googleConnect';
import type { StudioCoaching as Data } from '../api/studio';
import { clockLabel, WEEKDAY_NAMES } from '../display';
import { studioSessionHref } from '../paths';
import { CoachingForm } from './forms';
import styles from './coaching.module.css';

const KIND_LABELS: Record<CoachingKind, string> = { one_on_one: '1:1 (clients book)', group: 'Group (you schedule)' };

const OUTCOME: Record<ConnectOutcome, { text: string; tone: 'success' | 'danger' }> = {
  connected: { text: 'Google Calendar connected.', tone: 'success' },
  denied: { text: 'Google Calendar access was not granted.', tone: 'danger' },
  failed: { text: 'Connecting Google Calendar failed. Try again.', tone: 'danger' },
};

function Products({ products, imageSrc }: { products: Data['products']; imageSrc: ImageSrc }) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Coaching products
      </Heading>
      <ul aria-label="Coaching products" className={styles.rows}>
        {products.map(({ product: p, program }) => (
          <li key={p.id} className={styles.product}>
            <Heading level={3} variant="label">
              {p.title}
            </Heading>
            <CoachingForm fields={{ op: 'updateProduct', productId: p.id }} submit="Save">
              <ProductFields product={p} imageSrc={imageSrc} />
            </CoachingForm>
            <CoachingForm fields={{ op: 'saveProgram', productId: p.id }} submit="Save sessions">
              <ChoiceSelect name="kind" label="Type" value={program.kind} options={COACHING_KINDS} labels={KIND_LABELS} />
              <Field label="Session length (minutes)">
                <Input type="number" name="sessionMinutes" min={15} max={360} defaultValue={program.sessionMinutes} required />
              </Field>
              <Field label="Sessions included">
                <Input type="number" name="sessionsIncluded" min={1} defaultValue={program.sessionsIncluded} required />
              </Field>
              <Field label="Join link (https)">
                <Input type="url" name="location" defaultValue={program.location ?? ''} />
              </Field>
            </CoachingForm>
          </li>
        ))}
      </ul>
      <Heading level={3} variant="label">
        New coaching product
      </Heading>
      <CoachingForm fields={{ op: 'createProgram' }} submit="Add coaching product">
        <Field label="Title">
          <Input name="title" required />
        </Field>
        <Field label="Slug (optional)">
          <Input name="slug" />
        </Field>
      </CoachingForm>
    </Stack>
  );
}

function Settings({ settings: s }: { settings: Data['settings'] }) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Booking settings
      </Heading>
      <CoachingForm fields={{ op: 'saveSettings' }} submit="Save settings">
        <TimeZoneSelect value={s.timeZone} />
        <div className={styles.fields}>
          <Field label="Buffer before (minutes)">
            <Input type="number" name="bufferBeforeMin" min={0} defaultValue={s.bufferBeforeMin} required />
          </Field>
          <Field label="Buffer after (minutes)">
            <Input type="number" name="bufferAfterMin" min={0} defaultValue={s.bufferAfterMin} required />
          </Field>
          <Field label="Minimum notice (minutes)">
            <Input type="number" name="minNoticeMin" min={0} defaultValue={s.minNoticeMin} required />
          </Field>
          <Field label="Booking window (days)">
            <Input type="number" name="windowDays" min={1} max={200} defaultValue={s.windowDays} required />
          </Field>
          <Field label="Change cutoff (hours)">
            <Input type="number" name="cancelCutoffHours" min={0} defaultValue={s.cancelCutoffHours} required />
          </Field>
        </div>
      </CoachingForm>
    </Stack>
  );
}

function Hours({ rules, defaultHours, timeZone }: Pick<Data, 'rules' | 'defaultHours'> & { timeZone: string }) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Weekly hours
      </Heading>
      <Text tone="muted">
        {defaultHours ? 'Clients see weekdays 09:00 to 17:00 until you add your own hours.' : `Times in ${timeZone}.`}
      </Text>
      <ul aria-label="Weekly hours" className={styles.rows}>
        {rules.map((r) => (
          <li key={r.id} className={styles.row}>
            <Text>{`${WEEKDAY_NAMES[r.weekday]} ${clockLabel(r.startMinute)} – ${clockLabel(r.endMinute)}`}</Text>
            <CoachingForm inline variant="ghost" submit="Remove" fields={{ op: 'deleteRule', ruleId: r.id }} />
          </li>
        ))}
      </ul>
      <CoachingForm fields={{ op: 'addRule' }} submit="Add hours">
        <div className={styles.fields}>
          <Field label="Day">
            <Select name="weekday" defaultValue="1">
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={name} value={String(i)}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="time" name="start" defaultValue="09:00" required />
          </Field>
          <Field label="To">
            <Input type="time" name="end" defaultValue="17:00" required />
          </Field>
        </div>
      </CoachingForm>
    </Stack>
  );
}

const overrideLabel = (o: Data['overrides'][number]): string =>
  o.startMinute === null || o.endMinute === null ? `${o.date}: unavailable` : `${o.date}: ${clockLabel(o.startMinute)} – ${clockLabel(o.endMinute)}`;

function Overrides({ overrides }: Pick<Data, 'overrides'>) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Date overrides
      </Heading>
      <Text tone="muted">Replace the weekly hours on one date. Leave both times empty to block the day.</Text>
      <ul aria-label="Date overrides" className={styles.rows}>
        {overrides.map((o) => (
          <li key={o.id} className={styles.row}>
            <Text>{overrideLabel(o)}</Text>
            <CoachingForm inline variant="ghost" submit="Remove" fields={{ op: 'deleteOverride', overrideId: o.id }} />
          </li>
        ))}
      </ul>
      <CoachingForm fields={{ op: 'addOverride' }} submit="Add override">
        <div className={styles.fields}>
          <Field label="Date">
            <Input type="date" name="date" required />
          </Field>
          <Field label="From">
            <Input type="time" name="start" />
          </Field>
          <Field label="To">
            <Input type="time" name="end" />
          </Field>
        </div>
      </CoachingForm>
    </Stack>
  );
}

type CalendarProps = { calendar: Data['calendar']; outcome: ConnectOutcome | null; connect: FormAction; disconnect: FormAction };

function Calendar({ calendar, outcome, connect, disconnect }: CalendarProps) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Google Calendar
      </Heading>
      {outcome ? (
        <Text role="status" tone={OUTCOME[outcome].tone}>
          {OUTCOME[outcome].text}
        </Text>
      ) : null}
      {calendar ? (
        <>
          <Text>{`Connected as ${calendar.accountEmail}. Busy times block slots; sessions are added to your calendar.`}</Text>
          <ActionForm action={disconnect} fields={{}} submit="Disconnect" variant="danger" confirm={{ title: 'Disconnect Google Calendar?', tone: 'warning' }} />
        </>
      ) : (
        <>
          <Text tone="muted">Connect to block busy times and add sessions to your calendar.</Text>
          <ActionForm action={connect} fields={{}} submit="Connect Google Calendar" variant="primary" />
        </>
      )}
    </Stack>
  );
}

function Upcoming({ upcoming, timeZone }: { upcoming: Data['upcoming']; timeZone: string }) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Upcoming sessions
      </Heading>
      {upcoming.length === 0 ? (
        <EmptyState title="No upcoming sessions" />
      ) : (
        <ListGroup aria-label="Upcoming sessions">
          {upcoming.map((s) => (
            <LinkRow
              key={s.id}
              href={studioSessionHref(s.id)}
              title={s.clientName ? `${s.title} with ${s.clientName}` : `${s.title} (group)`}
              description={formatInZone(s.startsAt, timeZone)}
              trailing={s.outOfSync ? <Badge tone="warning">Not synced</Badge> : undefined}
            />
          ))}
        </ListGroup>
      )}
    </Stack>
  );
}

function GroupSession({ products, timeZone }: { products: Data['products']; timeZone: string }) {
  const groups = products.filter((p) => p.program.kind === 'group').map(({ product }) => product);
  if (groups.length === 0) return null;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Schedule a group session
      </Heading>
      <CoachingForm fields={{ op: 'createSession' }} submit="Schedule">
        <RowSelect name="productId" label="Product" value={groups[0]!.id} options={groups} />
        <Field label="Title">
          <Input name="title" required />
        </Field>
        <Field label="Starts">
          <Input type="datetime-local" name="startsAt" required />
        </Field>
        <TimeZoneSelect value={timeZone} />
        <Field label="Length (minutes)">
          <Input type="number" name="minutes" min={15} max={360} defaultValue={60} required />
        </Field>
        <Field label="Agenda">
          <Textarea name="agenda" rows={3} />
        </Field>
      </CoachingForm>
    </Stack>
  );
}

type Props = { data: Data; outcome: ConnectOutcome | null; connect: FormAction; disconnect: FormAction; imageSrc: ImageSrc };

export function StudioCoaching({ data, outcome, connect, disconnect, imageSrc }: Props) {
  const zone = data.settings.timeZone;
  return (
    <Stack gap="loose">
      <Upcoming upcoming={data.upcoming} timeZone={zone} />
      <GroupSession products={data.products} timeZone={zone} />
      <Products products={data.products} imageSrc={imageSrc} />
      <Settings settings={data.settings} />
      <Hours rules={data.rules} defaultHours={data.defaultHours} timeZone={zone} />
      <Overrides overrides={data.overrides} />
      {data.canManageCalendar ? <Calendar calendar={data.calendar} outcome={outcome} connect={connect} disconnect={disconnect} /> : null}
    </Stack>
  );
}
