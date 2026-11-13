// One DM thread: lines, the send box while both sides may write, who is typing, and block / unblock.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { Heading, Inline, Stack, Text } from '@/components/ui/mds';
import type { TypingConfig } from '@/components/Typing/typingConfig';
import type { DmThreadPage } from '../api/dms';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';

type Props = { communityId: string; page: DmThreadPage; action: FormAction; typing?: TypingConfig | null };

export function DmThread({ communityId, page, action, typing = null }: Props) {
  const { threadId, other, messages, canSend, blocking } = page;
  return (
    <Stack gap="loose">
      <Inline gap="tight" justify="between">
        <Heading level={1} variant="title">
          {other.name}
        </Heading>
        <ActionForm
          action={action}
          inline
          variant="ghost"
          submit={blocking ? 'Unblock' : 'Block'}
          confirm={blocking ? undefined : { title: `Block ${other.name}?`, description: 'Neither of you can send messages until you unblock.', tone: 'warning' }}
          fields={{ op: 'block', communityId, profileId: other.id, on: blocking ? 'false' : 'true' }}
        />
      </Inline>
      <MessageList messages={messages} action={action} />
      <ChatComposer
        typing={typing}
        composer={
          canSend
            ? {
                action,
                fields: { op: 'sendDm', threadId },
                members: [],
                submit: 'Send',
                label: `Message ${other.name}`,
                placeholder: 'Write a message…',
                rows: 2,
                files: { kind: 'attachment', target: 'thread', id: threadId, max: 1 },
              }
            : null
        }
      />
      {canSend ? null : <Text tone="muted">You cannot send messages in this conversation.</Text>}
    </Stack>
  );
}
