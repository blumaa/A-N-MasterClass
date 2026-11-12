// Review feed (Kajabi): tabs for reports, pending/rejected/hidden/locked posts, and the
// moderation log with a GET filter (action, date range).
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { ButtonLink } from '@/components/ui/links';
import { Button, EmptyState, Field, Inline, Input, ListGroup, ListItem, Select, Stack, Text } from '@/components/ui/mds';
import { formatDateTime } from '@/lib/format/date';
import { MODERATION_ACTIONS, type ModerationAction } from '@/lib/data/types';
import { REVIEW_TABS, type LogFilter, type LogItem, type Review, type ReviewTab } from '../api/review';
import { postHref, reviewTabHref } from '../paths';
import { PostCard } from './PostCard';
import { ReportQueue } from './ReportQueue';

type Props = {
  review: Review;
  /** Reports page (member or Studio); tabs add ?tab=. */
  page: string;
  action: FormAction;
};

const TAB_LABEL: Record<ReviewTab, string> = {
  reports: 'Reports',
  pending: 'Pending',
  rejected: 'Rejected',
  hidden: 'Hidden',
  locked: 'Locked',
  log: 'Log',
};

const ACTION_LABEL: Record<ModerationAction, string> = {
  hide: 'Hide',
  unhide: 'Unhide',
  lock: 'Lock',
  unlock: 'Unlock',
  approve: 'Approve',
  reject: 'Reject',
};

const DID: Record<ModerationAction, string> = {
  hide: 'hid',
  unhide: 'unhid',
  lock: 'locked',
  unlock: 'unlocked',
  approve: 'approved',
  reject: 'rejected',
};

export function ReviewFeed({ review, page, action }: Props) {
  return (
    <Stack gap="base">
      <nav aria-label="Review feed">
        <Inline gap="tight">
          {REVIEW_TABS.map((t) => (
            <ButtonLink key={t} href={reviewTabHref(page, t)} variant={t === review.tab ? 'primary' : 'ghost'} current={t === review.tab}>
              {TAB_LABEL[t]}
            </ButtonLink>
          ))}
        </Inline>
      </nav>
      <Body review={review} page={page} action={action} />
    </Stack>
  );
}

function Body({ review, page, action }: Props) {
  if (review.tab === 'reports') return <ReportQueue queue={review.queue} />;
  if (review.tab === 'log') return <Log page={page} filter={review.filter} entries={review.entries} />;
  if (review.posts.length === 0) return <EmptyState title={`No ${review.tab} posts`} />;
  return (
    <Stack gap="base">
      {review.posts.map((p) => (
        <PostCard key={p.id} post={p} action={action} href={postHref(review.community.slug, p.id)} moderate signedIn />
      ))}
    </Stack>
  );
}

function Log({ page, filter, entries }: { page: string; filter: LogFilter; entries: LogItem[] }) {
  return (
    <Stack gap="base">
      <form method="get" action={page} role="search" aria-label="Filter log">
        <input type="hidden" name="tab" value="log" />
        <Inline gap="tight">
          <Field label="Action">
            <Select name="action" defaultValue={filter.action ?? ''}>
              <option value="">All</option>
              {MODERATION_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" name="from" defaultValue={filter.from ?? ''} />
          </Field>
          <Field label="To">
            <Input type="date" name="to" defaultValue={filter.to ?? ''} />
          </Field>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </Inline>
      </form>
      {entries.length === 0 ? (
        <EmptyState title="No moderation yet" />
      ) : (
        <ListGroup aria-label="Moderation log">
          {entries.map((e) => (
            <ListItem
              key={e.id}
              href={e.href ?? undefined}
              title={`${e.actor} ${DID[e.action]} a ${e.targetType} in ${e.channel}`}
              description={e.preview ?? 'Content deleted'}
              trailing={<Text variant="meta">{formatDateTime(e.createdAt)}</Text>}
            />
          ))}
        </ListGroup>
      )}
    </Stack>
  );
}
