// Chat lines (channel or DM), oldest first, with delete where the viewer may. Channel lines
// are reportable (`report`); DM lines are not.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { EmptyState, Inline, Stack, Text } from '@/components/ui/mds';
import { formatDateTime } from '@/lib/format/date';
import type { MessageItem } from '../api/present';
import { MentionBody } from './MentionBody';
import { MessageAttachment } from './MessageAttachment';
import { ReportForm } from './ReportForm';
import styles from './community.module.css';

/** report: the report action (app/: it pushes to moderators); none = no Report buttons. */
type Props = { messages: MessageItem[]; action: FormAction; report?: FormAction };

export function MessageList({ messages, action, report }: Props) {
  if (messages.length === 0) return <EmptyState title="No messages yet" />;
  return (
    <ol aria-label="Messages" className={styles.rows}>
      {messages.map((m) => (
        <li key={m.id} className={styles.message}>
          <Stack gap="tight">
            <Inline gap="tight" justify="between">
              <Text variant="label">{m.author.name}</Text>
              <Inline gap="tight">
                <Text variant="meta" tone="muted">
                  {formatDateTime(m.createdAt)}
                </Text>
                {m.canDelete ? (
                  <ActionForm
                    action={action}
                    inline
                    variant="ghost"
                    submit="Delete"
                    confirm="Delete this message?"
                    fields={{ op: 'deleteMessage', messageId: m.id }}
                  />
                ) : null}
                {report && !m.mine ? <ReportForm targetType="message" targetId={m.id} action={report} /> : null}
              </Inline>
            </Inline>
            {m.body ? <MentionBody body={m.body} /> : null}
            {m.attachment ? <MessageAttachment file={m.attachment} /> : null}
          </Stack>
        </li>
      ))}
    </ol>
  );
}
