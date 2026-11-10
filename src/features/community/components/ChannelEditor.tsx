// Studio > community > channels: add, rename, privacy, read-only, members of private channels, reorder, delete.
import { Badge, Field, Heading, Input, Select, Stack, Text } from '@/components/ui/mds';
import { CHANNEL_KINDS, CHANNEL_PRIVACIES, type AccessGroup, type Channel } from '@/lib/data/types';
import type { DirectoryEntry } from '../api/feed';
import { CommunityForm } from './CommunityForm';
import { ChoiceSelect, YesNoSelect } from './fields';
import { KIND_LABELS, PRIVACY_LABELS } from './labels';
import styles from './community.module.css';

type MemberPickerProps = { channel: Channel; members: readonly DirectoryEntry[]; picked: readonly string[] };

function MemberPicker({ channel, members, picked }: MemberPickerProps) {
  const ids = new Set(picked);
  const inside = members.filter((m) => ids.has(m.id));
  const outside = members.filter((m) => !ids.has(m.id) && !m.staff);
  const base = { op: 'setChannelMember', channelId: channel.id };
  return (
    <Stack gap="tight">
      {inside.length === 0 ? (
        <Text tone="muted">No members invited yet.</Text>
      ) : (
        <ul aria-label={`Members of ${channel.title}`} className={styles.rows}>
          {inside.map((m) => (
            <li key={m.id} className={styles.channelRow}>
              <Text>{m.name}</Text>
              <CommunityForm inline variant="ghost" submit="Remove" fields={{ ...base, profileId: m.id, on: 'false' }} />
            </li>
          ))}
        </ul>
      )}
      {outside.length === 0 ? null : (
        <CommunityForm inline fields={{ ...base, on: 'true' }} submit="Add member">
          <Field label="Invite member">
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
};

function ChannelRow({ channel, group, first, last, members, picked }: RowProps) {
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
        {channel.privacy === 'private' ? <MemberPicker channel={channel} members={members} picked={picked} /> : null}
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
};

export function ChannelEditor({ communityId, channels, groups, members, channelMembers }: Props) {
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
