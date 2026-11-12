// One DM thread: lines, the send box while both sides may write, and block / unblock.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { Heading, Inline, Stack, Text } from '@/components/ui/mds';
import type { DmThreadPage } from '../api/dms';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

type Props = { communityId: string; page: DmThreadPage; action: FormAction };

export function DmThread({ communityId, page, action }: Props) {
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
          confirm={blocking ? undefined : `Block ${other.name}? Neither of you can send messages until you unblock.`}
          fields={{ op: 'block', communityId, profileId: other.id, on: blocking ? 'false' : 'true' }}
        />
      </Inline>
      <MessageList messages={messages} action={action} />
      {canSend ? (
        <Composer
          action={action}
          fields={{ op: 'sendDm', threadId }}
          members={[]}
          submit="Send"
          label={`Message ${other.name}`}
          placeholder="Write a message…"
          rows={2}
          files={{ kind: 'attachment', target: 'thread', id: threadId, max: 1 }}
        />
      ) : (
        <Text tone="muted">You cannot send messages in this conversation.</Text>
      )}
    </Stack>
  );
}
