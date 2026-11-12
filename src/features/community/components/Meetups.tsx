// Member side of meetups (G14): upcoming + past lists and one meetup occurrence with RSVP, the join link
// (shown by the API only while joinable), the replay after it ends and an "Add to calendar" file.
// Times in the member's zone (Kajabi converts meetups to the device zone), the meetup's own zone as
// secondary text when it reads differently. `viewerZone` null = the meetup's zone only.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { ButtonLink, LinkRow } from '@/components/ui/links';
import { Badge, EmptyState, Heading, Inline, ListGroup, Stack, Text } from '@/components/ui/mds';
import { VimeoEmbed } from '@/components/VimeoEmbed/VimeoEmbed';
import { describeRepeat } from '@/lib/calendar/describeRepeat';
import { zonedText } from '@/lib/time/zonedText';
import { vimeoPlayerUrl } from '@/lib/video/vimeo';
import { JOIN_OPENS_MINUTES, type MeetupItem, type MeetupList as Lists, type MeetupState } from '../api/meetups';
import { meetupHref, meetupIcsHref } from '../paths';

const STATE: Record<MeetupState, { label: string; tone: 'accent' | 'success' | 'neutral' }> = {
  upcoming: { label: 'Upcoming', tone: 'accent' },
  live: { label: 'Live now', tone: 'success' },
  past: { label: 'Past', tone: 'neutral' },
};

type Zone = { viewerZone: string | null };

const when = (m: MeetupItem, viewerZone: string | null) => zonedText([m.startsAt, m.endsAt], viewerZone, m.timeZone);
const ownLabel = (own: string): string => `Meetup's time: ${own}`;
const goingLabel = (n: number): string => (n === 1 ? '1 going' : `${n} going`);

function rowText(m: MeetupItem, viewerZone: string | null): string {
  const t = when(m, viewerZone);
  return [t.local, t.own && ownLabel(t.own), goingLabel(m.rsvpCount), m.going && 'You are going'].filter(Boolean).join(' · ');
}

function Rows({ community, label, items, viewerZone }: { community: string; label: string; items: MeetupItem[] } & Zone) {
  return (
    <ListGroup aria-label={label}>
      {items.map((m) => (
        <LinkRow
          key={m.key}
          href={meetupHref(community, m.key)}
          title={m.title}
          description={rowText(m, viewerZone)}
          trailing={<Badge tone={STATE[m.state].tone}>{STATE[m.state].label}</Badge>}
        />
      ))}
    </ListGroup>
  );
}

export function MeetupList({ community, meetups, viewerZone }: { community: string; meetups: Lists } & Zone) {
  return (
    <Stack gap="loose">
      {meetups.upcoming.length === 0 ? (
        <EmptyState title="No upcoming meetups" />
      ) : (
        <Rows community={community} label="Upcoming meetups" items={meetups.upcoming} viewerZone={viewerZone} />
      )}
      {meetups.past.length > 0 ? (
        <Stack gap="base">
          <Heading level={2} variant="subtitle">
            Past meetups
          </Heading>
          <Rows community={community} label="Past meetups" items={meetups.past} viewerZone={viewerZone} />
        </Stack>
      ) : null}
    </Stack>
  );
}

type DetailProps = {
  community: string;
  meetup: MeetupItem;
  action: FormAction;
  signedIn: boolean;
} & Zone;

export function MeetupDetail({ community, meetup: m, action, signedIn, viewerZone }: DetailProps) {
  const repeats = describeRepeat(m);
  const time = when(m, viewerZone);
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Inline gap="tight">
          <Heading level={1} variant="title">
            {m.title}
          </Heading>
          <Badge tone={STATE[m.state].tone}>{STATE[m.state].label}</Badge>
        </Inline>
        <Text tone="muted">{`${time.local} · ${goingLabel(m.rsvpCount)}`}</Text>
        {time.own ? <Text tone="muted">{ownLabel(time.own)}</Text> : null}
        {repeats ? <Text tone="muted">{`Repeats: ${repeats}${time.own ? ` (${m.timeZone})` : ''}`}</Text> : null}
        {m.description ? <Text>{m.description}</Text> : null}
      </Stack>
      {m.state === 'past' ? null : (
        <Inline gap="base">
          {m.joinUrl ? (
            <ButtonLink href={m.joinUrl}>Join meetup</ButtonLink>
          ) : (
            <Text tone="muted">The join link appears {JOIN_OPENS_MINUTES} minutes before the start.</Text>
          )}
          {signedIn ? (
            <ActionForm
              action={action}
              inline
              fields={{ op: 'rsvp', meetupId: m.id, occurrence: String(m.occurrence), on: String(!m.going) }}
              submit={m.going ? 'Cancel RSVP' : 'RSVP'}
              variant={m.going ? 'ghost' : 'secondary'}
            />
          ) : null}
          <ButtonLink href={meetupIcsHref(community, m.key)} variant="ghost">
            Add to calendar
          </ButtonLink>
        </Inline>
      )}
      {m.replayVimeoId ? <VimeoEmbed src={vimeoPlayerUrl(m.replayVimeoId)} title={`${m.title} replay`} aspect={16 / 9} /> : null}
    </Stack>
  );
}
