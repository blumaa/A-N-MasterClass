// Studio > community > access groups (Kajabi tiers: directory, DM, challenge, meetup and leaderboard toggles) and messaging settings.
// https://help.kajabi.com/en/articles/17174417-community-access-groups
import { Badge, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import type { AccessGroup, CommunitySettings } from '@/lib/data/types';
import { CommunityForm } from './CommunityForm';
import { YesNoSelect } from './fields';
import styles from './community.module.css';

function GroupRow({ group }: { group: AccessGroup }) {
  const id = { groupId: group.id };
  return (
    <li className={styles.channelRow}>
      {group.isDefault ? <Badge tone="neutral">Default</Badge> : null}
      <CommunityForm inline fields={{ op: 'updateGroup', ...id }} submit="Save">
        <Field label="Group title">
          <Input name="title" defaultValue={group.title} required />
        </Field>
        <YesNoSelect name="directory" label="Member directory" value={group.directory} yes="Shown" no="Hidden" />
        <YesNoSelect name="dms" label="Start direct messages" value={group.dms} yes="Allowed" no="Not allowed" />
        <YesNoSelect name="challenges" label="Challenges" value={group.challenges} yes="Shown" no="Hidden" />
        <YesNoSelect name="meetups" label="Meetups" value={group.meetups} yes="Shown" no="Hidden" />
        <YesNoSelect name="leaderboard" label="Leaderboard" value={group.leaderboard} yes="Shown" no="Hidden" />
      </CommunityForm>
      {group.isDefault ? null : (
        <CommunityForm
          inline
          variant="danger"
          submit="Delete"
          confirm={`Delete group "${group.title}"?`}
          fields={{ op: 'deleteGroup', ...id }}
        />
      )}
    </li>
  );
}

type Props = { communityId: string; groups: readonly AccessGroup[]; settings: CommunitySettings };

export function GroupEditor({ communityId, groups, settings }: Props) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Access groups
      </Heading>
      <Text tone="muted">Offers grant a group. Channels belong to one group.</Text>
      <ul aria-label="Access groups" className={styles.rows}>
        {groups.map((g) => (
          <GroupRow key={g.id} group={g} />
        ))}
      </ul>
      <CommunityForm inline fields={{ op: 'createGroup', communityId }} submit="Add group">
        <Field label="New group title">
          <Input name="title" required />
        </Field>
      </CommunityForm>
      <Heading level={2} variant="subtitle">
        Messaging
      </Heading>
      <CommunityForm inline fields={{ op: 'saveSettings', communityId }} submit="Save messaging">
        <YesNoSelect name="dmsEnabled" label="Direct messages" value={settings.dmsEnabled} yes="On" no="Off" />
        <YesNoSelect name="founderDms" label="Members can message the owner" value={settings.founderDms} yes="Yes" no="No" />
      </CommunityForm>
    </Stack>
  );
}
