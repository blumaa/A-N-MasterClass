// Studio > community > channels: add, rename, privacy, read-only, members of private channels,
// channel moderators (G15), reorder, delete.
import { Badge, Field, Heading, Input, Select, Stack } from '@/components/ui/mds';
import { CHANNEL_KINDS, CHANNEL_PRIVACIES, type AccessGroup, type Channel } from '@/lib/data/types';
import type { DirectoryEntry } from '../api/feed';
import { MoveButtons } from '@/components/MoveButtons/MoveButtons';
import { CommunityForm } from './CommunityForm';
import { ChoiceSelect, YesNoSelect } from '@/components/fields/fields';
import { KIND_LABELS, PRIVACY_LABELS } from './labels';
import { PeoplePicker } from './PeoplePicker';
import styles from './community.module.css';

type PickerKind = 'members' | 'moderators';

const PICKERS = {
  members: { op: 'setChannelMember', list: 'Members of', empty: 'No members invited yet.', field: 'Invite member', add: 'Add member' },
  moderators: { op: 'setChannelModerator', list: 'Moderators of', empty: 'No moderators picked yet.', field: 'Pick moderator', add: 'Add moderator' },
} as const;

type PickerProps = { kind: PickerKind; channel: Channel; candidates: readonly DirectoryEntry[]; picked: readonly string[] };

/** Picked people of one channel (private members or moderators). */
function Picker({ kind, channel, candidates, picked }: PickerProps) {
  const { op, list, ...text } = PICKERS[kind];
  return <PeoplePicker text={{ ...text, list: `${list} ${channel.title}` }} base={{ op, channelId: channel.id }} candidates={candidates} picked={picked} />;
}

type RowProps = {
  channel: Channel;
  group: string;
  first: boolean;
  last: boolean;
  members: readonly DirectoryEntry[];
  picked: readonly string[];
  /** Null when the viewer may not pick moderators. */
  moderators: readonly string[] | null;
};

function ChannelRow({ channel, group, first, last, members, picked, moderators }: RowProps) {
  const isPrivate = channel.privacy === 'private';
  // A moderator must read the channel: in a private one, only its picked members.
  const readers = isPrivate ? members.filter((m) => picked.includes(m.id)) : members;
  const id = { channelId: channel.id };
  return (
    <li className={styles.channelRow}>
      <Stack gap="tight">
        <div className={styles.rowActions}>
          <Badge tone="neutral">{KIND_LABELS[channel.kind]}</Badge>
          <Badge tone="neutral">{group}</Badge>
        </div>
        <CommunityForm inline fields={{ op: 'updateChannel', ...id }} submit="Save">
          <Field label="Channel title">
            <Input name="title" defaultValue={channel.title} required />
          </Field>
          <ChoiceSelect name="privacy" label="Who sees it" value={channel.privacy} options={CHANNEL_PRIVACIES} labels={PRIVACY_LABELS} />
          <YesNoSelect name="readOnly" label="Who can write" value={channel.readOnly} yes="Staff only" no="All who see it" />
        </CommunityForm>
        {isPrivate ? <Picker kind="members" channel={channel} candidates={members} picked={picked} /> : null}
        {moderators ? <Picker kind="moderators" channel={channel} candidates={readers} picked={moderators} /> : null}
      </Stack>
      <div className={styles.rowActions}>
        <MoveButtons form={CommunityForm} fields={{ op: 'moveChannel', ...id }} first={first} last={last} />
        <CommunityForm
          inline
          variant="ghost"
          submit="Delete"
          confirm={{ title: `Delete channel "${channel.title}"?`, description: 'Everything in it is deleted too.' }}
          fields={{ op: 'deleteChannel', ...id }}
        />
      </div>
    </li>
  );
}

type Props = {
  communityId: string;
  channels: readonly Channel[];
  groups: readonly AccessGroup[];
  members: readonly DirectoryEntry[];
  channelMembers: Readonly<Record<string, string[]>>;
  /** Null when the viewer may not pick moderators. */
  channelModerators: Readonly<Record<string, string[]>> | null;
};

export function ChannelEditor({ communityId, channels, groups, members, channelMembers, channelModerators }: Props) {
  const groupTitle = new Map(groups.map((g) => [g.id, g.title]));
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Channels
      </Heading>
      <ul aria-label="Channels" className={styles.rows}>
        {channels.map((c, i) => (
          <ChannelRow
            key={c.id}
            channel={c}
            group={groupTitle.get(c.accessGroupId) ?? ''}
            first={i === 0}
            last={i === channels.length - 1}
            members={members}
            picked={channelMembers[c.id] ?? []}
            moderators={channelModerators ? (channelModerators[c.id] ?? []) : null}
          />
        ))}
      </ul>
      <CommunityForm inline fields={{ op: 'createChannel', communityId }} submit="Add channel">
        <Field label="New channel title">
          <Input name="title" required />
        </Field>
        <ChoiceSelect name="kind" label="Type" value="feed" options={CHANNEL_KINDS} labels={KIND_LABELS} />
        <ChoiceSelect name="privacy" label="Who sees it" value="public" options={CHANNEL_PRIVACIES} labels={PRIVACY_LABELS} />
        <YesNoSelect name="readOnly" label="Who can write" value={false} yes="Staff only" no="All who see it" />
        <Field label="Access group">
          <Select name="accessGroupId" defaultValue={groups.find((g) => g.isDefault)?.id}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </Field>
      </CommunityForm>
    </Stack>
  );
}
