// A chat channel: latest lines, then the send box (when the viewer may send).
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { Heading, Stack, Text } from '@/components/ui/mds';
import type { CommunityPage } from '../api/feed';
import { Composer } from './Composer';
import { LiveRefresh } from './LiveRefresh';
import { MessageList } from './MessageList';

type Props = { page: Extract<CommunityPage, { kind: 'open' }>; action: FormAction };

export function ChannelChat({ page, action }: Props) {
  const { channel, canPost, messages, members } = page;
  return (
    <Stack gap="loose">
      <LiveRefresh />
      <Heading level={1} variant="title">
        {channel.title}
      </Heading>
      <MessageList messages={messages} action={action} />
      {canPost ? (
        <Composer
          action={action}
          fields={{ op: 'sendMessage', channelId: channel.id }}
          members={members}
          submit="Send"
          label={`Message ${channel.title}`}
          placeholder="Write a message…"
          rows={2}
        />
      ) : channel.readOnly ? (
        <Text tone="muted">Only staff send in this channel.</Text>
      ) : null}
    </Stack>
  );
}
