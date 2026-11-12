// Reports queue of one community (Studio and the member side share it). Open reports carry a
// preview and Dismiss / Hide (posts, comments) / Remove content; resolved ones stay, signed. The reporter shows only when
// the API gives it (staff).
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { EmptyState, Heading, Inline, ListGroup, ListItem, Stack, Text } from '@/components/ui/mds';
import { formatDateTime } from '@/lib/format/date';
import type { ReportStatus, ReportTarget } from '@/lib/data/types';
import type { ReportEntry, ReportQueue as Queue } from '../api/reports';
import { reportAction } from '../reportActions';

const TARGET: Record<ReportTarget, string> = { post: 'Post', comment: 'Comment', message: 'Chat line' };
const STATUS: Record<ReportStatus, string> = { open: 'Reported', dismissed: 'Dismissed', removed: 'Removed', hidden: 'Hidden' };

function Details({ e }: { e: ReportEntry }) {
  const signed = e.resolvedAt ? `${STATUS[e.status]} by ${e.resolvedBy ?? 'someone'} · ${formatDateTime(e.resolvedAt)}` : null;
  return (
    <Stack gap="tight">
      <Text>{e.preview ? `${e.preview.author}: ${e.preview.body}` : 'Content removed'}</Text>
      {e.reason ? <Text variant="note">Reason: {e.reason}</Text> : null}
      <Text variant="meta">
        {`Reported ${formatDateTime(e.createdAt)}`}
        {e.reporter ? ` · Reported by ${e.reporter}` : null}
      </Text>
      {signed ? <Text variant="meta">{signed}</Text> : null}
    </Stack>
  );
}

const resolveFields = (e: ReportEntry, action: 'dismiss' | 'remove' | 'hide') => ({ op: 'resolveReport', reportId: e.id, action });

function Actions({ e }: { e: ReportEntry }) {
  return (
    <Inline gap="tight">
      <ActionForm action={reportAction} inline variant="secondary" submit="Dismiss" fields={resolveFields(e, 'dismiss')} />
      {e.targetType === 'message' ? null : (
        <ActionForm action={reportAction} inline variant="secondary" submit="Hide" fields={resolveFields(e, 'hide')} />
      )}
      <ActionForm
        action={reportAction}
        inline
        variant="danger"
        submit="Remove content"
        confirm="Delete this content for everyone?"
        fields={resolveFields(e, 'remove')}
      />
    </Inline>
  );
}

function Entries({ label, entries, open }: { label: string; entries: ReportEntry[]; open: boolean }) {
  return (
    <ListGroup aria-label={label}>
      {entries.map((e) => (
        <ListItem
          key={e.id}
          href={e.href}
          title={`${TARGET[e.targetType]} in ${e.channel}`}
          description={<Details e={e} />}
          actions={open ? <Actions e={e} /> : undefined}
        />
      ))}
    </ListGroup>
  );
}

export function ReportQueue({ queue }: { queue: Queue }) {
  return (
    <Stack gap="loose">
      {queue.open.length === 0 ? <EmptyState title="No open reports" /> : <Entries label="Open reports" entries={queue.open} open />}
      {queue.resolved.length > 0 ? (
        <Stack gap="base">
          <Heading level={2} variant="subtitle">
            Resolved
          </Heading>
          <Entries label="Resolved reports" entries={queue.resolved} open={false} />
        </Stack>
      ) : null}
    </Stack>
  );
}
