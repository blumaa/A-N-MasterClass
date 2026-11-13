// Member side of challenges: the list (upcoming, open, ended) and one challenge with the entry
// form while open. Staff also see every entry and a CSV export (entries are staff-only).
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { ButtonLink, LinkRow } from '@/components/ui/links';
import { Badge, Card, CardBody, EmptyState, Field, Heading, Inline, ListGroup, ListItem, Stack, Text, Textarea } from '@/components/ui/mds';
import { formatDateTime } from '@/lib/format/date';
import type { ChallengeItem, ChallengePage, ChallengeState } from '../api/challenges';
import { challengeEntriesCsvHref, challengeHref } from '../paths';

const STATE: Record<ChallengeState, { label: string; tone: 'accent' | 'success' | 'neutral' }> = {
  upcoming: { label: 'Upcoming', tone: 'accent' },
  open: { label: 'Open', tone: 'success' },
  ended: { label: 'Ended', tone: 'neutral' },
};

const when = (c: ChallengeItem): string => `${formatDateTime(c.startsAt)} – ${formatDateTime(c.endsAt)} UTC`;
const entriesLabel = (n: number): string => (n === 1 ? '1 entry' : `${n} entries`);

export function ChallengeList({ community, challenges }: { community: string; challenges: ChallengeItem[] }) {
  if (challenges.length === 0) return <EmptyState title="No challenges yet" />;
  return (
    <ListGroup aria-label="Challenges">
      {challenges.map((c) => (
        <LinkRow
          key={c.id}
          href={challengeHref(community, c.id)}
          title={c.title}
          description={`${when(c)} · ${entriesLabel(c.entryCount)}${c.mine ? ' · You entered' : ''}`}
          trailing={<Badge tone={STATE[c.state].tone}>{STATE[c.state].label}</Badge>}
        />
      ))}
    </ListGroup>
  );
}

type DetailProps = { community: string; page: ChallengePage; action: FormAction; signedIn: boolean };

function EntryBox({ challenge, action, signedIn }: { challenge: ChallengeItem; action: FormAction; signedIn: boolean }) {
  const id = { challengeId: challenge.id };
  if (challenge.mine) {
    return (
      <Card>
        <CardBody>
          <Stack gap="tight">
            <Text variant="label">Your entry</Text>
            <Text>{challenge.mine.body}</Text>
            {challenge.state === 'open' ? (
              <ActionForm action={action} fields={{ op: 'withdraw', ...id }} submit="Withdraw entry" variant="ghost" confirm={{ title: 'Withdraw your entry?' }} />
            ) : null}
          </Stack>
        </CardBody>
      </Card>
    );
  }
  if (challenge.state !== 'open') return <Text tone="muted">{challenge.state === 'upcoming' ? 'Entries open at the start time.' : 'This challenge has ended.'}</Text>;
  if (!signedIn) return <Text tone="muted">Sign in to enter.</Text>;
  return (
    <ActionForm action={action} fields={{ op: 'enter', ...id }} submit="Submit entry">
      <Field label="Your entry">
        <Textarea name="body" required rows={4} />
      </Field>
    </ActionForm>
  );
}

export function ChallengeDetail({ community, page, action, signedIn }: DetailProps) {
  const c = page.challenge;
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Inline gap="tight">
          <Heading level={1} variant="title">
            {c.title}
          </Heading>
          <Badge tone={STATE[c.state].tone}>{STATE[c.state].label}</Badge>
        </Inline>
        <Text tone="muted">{when(c)}</Text>
        {c.description ? <Text>{c.description}</Text> : null}
        {c.prize ? <Text>Prize: {c.prize}</Text> : null}
      </Stack>
      <EntryBox challenge={c} action={action} signedIn={signedIn} />
      {page.entries ? (
        <Stack gap="base">
          <Inline gap="base">
            <Heading level={2} variant="subtitle">
              Entries ({page.entries.length})
            </Heading>
            <ButtonLink href={challengeEntriesCsvHref(community, c.id)} variant="secondary">
              Export CSV
            </ButtonLink>
          </Inline>
          {page.entries.length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <ListGroup aria-label="Entries">
              {page.entries.map((e) => (
                <ListItem key={e.author.id} title={e.author.name} description={e.body} trailing={<Text variant="meta">{formatDateTime(e.createdAt)}</Text>} />
              ))}
            </ListGroup>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
