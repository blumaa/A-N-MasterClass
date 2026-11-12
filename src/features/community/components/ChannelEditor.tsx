// Studio > community > channels: add, rename, privacy, read-only, members of private channels,
// channel moderators (G15), reorder, delete.
import { Badge, Field, Heading, Input, Select, Stack, Text } from '@/components/ui/mds';
import { CHANNEL_KINDS, CHANNEL_PRIVACIES, type AccessGroup, type Channel } from '@/lib/data/types';
import type { DirectoryEntry } from '../api/feed';
import { CommunityForm } from './CommunityForm';
import { ChoiceSelect, YesNoSelect } from '@/components/fields/fields';
import { KIND_LABELS, PRIVACY_LABELS } from './labels';
import styles from './community.module.css';

type PickerKind = 'members' | 'moderators';

const PICKERS = {
  members: { op: 'setChannelMember', list: 'Members of', empty: 'No members invited yet.', field: 'Invite member', add: 'Add member' },
  moderators: { op: 'setChannelModerator', list: 'Moderators of', empty: 'No moderators picked yet.', field: 'Pick moderator', add: 'Add moderator' },
} as const;

type PickerProps = { kind: PickerKind; channel: Channel; candidates: readonly DirectoryEntry[]; picked: readonly string[] };

/** Picked people of one channel (private members or moderators), from non-staff candidates. */
function Picker({ kind, channel, candidates, picked }: PickerProps) {
  const text = PICKERS[kind];
  const ids = new Set(picked);
  const inside = candidates.filter((m) => ids.has(m.id));
  const outside = candidates.filter((m) => !ids.has(m.id) && !m.staff);
  const base = { op: text.op, channelId: channel.id };
  return (
    <Stack gap="tight">
      {inside.length === 0 ? (
        <Text tone="muted">{text.empty}</Text>
      ) : (
        <ul aria-label={`${text.list} ${channel.title}`} className={styles.rows}>
          {inside.map((m) => (
            <li key={m.id} className={styles.channelRow}>
              <Text>{m.name}</Text>
              <CommunityForm inline variant="ghost" submit="Remove" fields={{ ...base, profileId: m.id, on: 'false' }} />
            </li>
          ))}
        </ul>
      )}
      {outside.length === 0 ? null : (
        <CommunityForm inline fields={{ ...base, on: 'true' }} submit={text.add}>
          <Field label={text.field}>
            <Select name="profileId">
              {outside.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </CommunityForm>
      )}
    </Stack>
  );
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
          <Badge tone="neutral">{channel.kind}</Badge>
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
        {first ? null : <CommunityForm inline variant="ghost" submit="Move up" fields={{ op: 'moveChannel', ...id, direction: 'up' }} />}
        {last ? null : <CommunityForm inline variant="ghost" submit="Move down" fields={{ op: 'moveChannel', ...id, direction: 'down' }} />}
        <CommunityForm
          inline
          variant="danger"
          submit="Delete"
          confirm={`Delete channel "${channel.title}" and everything in it?`}
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
