// Chat lines (channel or DM), oldest first, with delete where the viewer may. Channel lines
// are reportable (`report`); DM lines are not.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { EmptyState, Inline, Stack, Text } from '@/components/ui/mds';
import { formatDateTime } from '@/lib/format/date';
import type { MessageItem } from '../api/present';
import { MentionBody } from './MentionBody';
import { ReportForm } from './ReportForm';
import styles from './community.module.css';

type Props = { messages: MessageItem[]; action: FormAction; report?: boolean };

export function MessageList({ messages, action, report = false }: Props) {
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
                {report && !m.mine ? <ReportForm targetType="message" targetId={m.id} /> : null}
              </Inline>
            </Inline>
            <MentionBody body={m.body} />
          </Stack>
        </li>
      ))}
    </ol>
  );
}
