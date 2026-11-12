// A chat channel: latest lines, then the send box (when the viewer may send) and who is typing.
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { Heading, Stack, Text } from '@/components/ui/mds';
import type { TypingConfig } from '@/components/Typing/typingConfig';
import type { CommunityPage } from '../api/feed';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';

type Props = {
  page: Extract<CommunityPage, { kind: 'open' }>;
  action: FormAction;
  report: FormAction;
  signedIn: boolean;
  typing?: TypingConfig | null;
};

export function ChannelChat({ page, action, report, signedIn, typing = null }: Props) {
  const { channel, rules, messages, members } = page;
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {channel.title}
      </Heading>
      <MessageList messages={messages} action={action} report={signedIn ? report : undefined} />
      <ChatComposer
        typing={typing}
        composer={
          rules.post
            ? {
                action,
                fields: { op: 'sendMessage', channelId: channel.id },
                members,
                submit: 'Send',
                label: `Message ${channel.title}`,
                placeholder: 'Write a message…',
                rows: 2,
                files: { kind: 'attachment', target: 'channel', id: channel.id, max: 1 },
              }
            : null
        }
      />
      {!rules.post && channel.readOnly ? <Text tone="muted">Only staff send in this channel.</Text> : null}
    </Stack>
  );
}
