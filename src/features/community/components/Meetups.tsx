// Member side of meetups (G14): upcoming + past lists and one meetup with RSVP, the join link
// (shown by the API only while joinable), the replay after it ends and an "Add to calendar" file.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { ButtonLink, LinkRow } from '@/components/ui/links';
import { Badge, EmptyState, Heading, Inline, ListGroup, Stack, Text } from '@/components/ui/mds';
import { VimeoEmbed } from '@/components/VimeoEmbed/VimeoEmbed';
import { formatInZone } from '@/lib/format/date';
import { vimeoPlayerUrl } from '@/lib/video/vimeo';
import { JOIN_OPENS_MINUTES, type MeetupItem, type MeetupList as Lists, type MeetupState } from '../api/meetups';
import { meetupHref, meetupIcsHref } from '../paths';

const STATE: Record<MeetupState, { label: string; tone: 'accent' | 'success' | 'neutral' }> = {
  upcoming: { label: 'Upcoming', tone: 'accent' },
  live: { label: 'Live now', tone: 'success' },
  past: { label: 'Past', tone: 'neutral' },
};

const when = (m: MeetupItem): string => `${formatInZone(m.startsAt, m.timeZone)} – ${formatInZone(m.endsAt, m.timeZone)}`;
const goingLabel = (n: number): string => (n === 1 ? '1 going' : `${n} going`);

function Rows({ community, label, items }: { community: string; label: string; items: MeetupItem[] }) {
  return (
    <ListGroup aria-label={label}>
      {items.map((m) => (
        <LinkRow
          key={m.id}
          href={meetupHref(community, m.id)}
          title={m.title}
          description={`${when(m)} · ${goingLabel(m.rsvpCount)}${m.going ? ' · You are going' : ''}`}
          trailing={<Badge tone={STATE[m.state].tone}>{STATE[m.state].label}</Badge>}
        />
      ))}
    </ListGroup>
  );
}

export function MeetupList({ community, meetups }: { community: string; meetups: Lists }) {
  return (
    <Stack gap="loose">
      {meetups.upcoming.length === 0 ? (
        <EmptyState title="No upcoming meetups" />
      ) : (
        <Rows community={community} label="Upcoming meetups" items={meetups.upcoming} />
      )}
      {meetups.past.length > 0 ? (
        <Stack gap="base">
          <Heading level={2} variant="subtitle">
            Past meetups
          </Heading>
          <Rows community={community} label="Past meetups" items={meetups.past} />
        </Stack>
      ) : null}
    </Stack>
  );
}

type DetailProps = { community: string; meetup: MeetupItem; action: FormAction; signedIn: boolean };

export function MeetupDetail({ community, meetup: m, action, signedIn }: DetailProps) {
  const id = { meetupId: m.id };
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Inline gap="tight">
          <Heading level={1} variant="title">
            {m.title}
          </Heading>
          <Badge tone={STATE[m.state].tone}>{STATE[m.state].label}</Badge>
        </Inline>
        <Text tone="muted">
          {when(m)} · {goingLabel(m.rsvpCount)}
        </Text>
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
              fields={{ op: 'rsvp', ...id, on: String(!m.going) }}
              submit={m.going ? 'Cancel RSVP' : 'RSVP'}
              variant={m.going ? 'ghost' : 'secondary'}
            />
          ) : null}
          <ButtonLink href={meetupIcsHref(community, m.id)} variant="ghost">
            Add to calendar
          </ButtonLink>
        </Inline>
      )}
      {m.replayVimeoId ? <VimeoEmbed src={vimeoPlayerUrl(m.replayVimeoId)} title={`${m.title} replay`} aspect={16 / 9} /> : null}
    </Stack>
  );
}
