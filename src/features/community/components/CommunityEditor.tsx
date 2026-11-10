// Studio > one community: settings, channels (add, rename, visibility, reorder, delete), staff ticks (G15).
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';
import { Badge, Field, Heading, Input, Select, Stack, Text } from '@/components/ui/mds';
import { CHANNEL_VISIBILITIES, type Channel, type ChannelVisibility } from '@/lib/data/types';
import type { StaffTick, StudioCommunity } from '../api/studio';
import { CommunityForm } from './CommunityForm';
import styles from './community.module.css';

const VISIBILITY_LABELS: Record<ChannelVisibility, string> = {
  public: 'Members can post',
  read_only: 'Read only (staff post)',
};

function VisibilitySelect({ value }: { value: ChannelVisibility }) {
  return (
    <Field label="Who can post">
      <Select name="visibility" defaultValue={value}>
        {CHANNEL_VISIBILITIES.map((v) => (
          <option key={v} value={v}>
            {VISIBILITY_LABELS[v]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ChannelRow({ channel, first, last }: { channel: Channel; first: boolean; last: boolean }) {
  const id = { channelId: channel.id };
  return (
    <li className={styles.channelRow}>
      <CommunityForm inline fields={{ op: 'updateChannel', ...id }} submit="Save">
        <Field label="Channel title">
          <Input name="title" defaultValue={channel.title} required />
        </Field>
        <VisibilitySelect value={channel.visibility} />
      </CommunityForm>
      <div className={styles.rowActions}>
        {first ? null : <CommunityForm inline variant="ghost" submit="Move up" fields={{ op: 'moveChannel', ...id, direction: 'up' }} />}
        {last ? null : <CommunityForm inline variant="ghost" submit="Move down" fields={{ op: 'moveChannel', ...id, direction: 'down' }} />}
        <CommunityForm
          inline
          variant="danger"
          submit="Delete"
          confirm={`Delete channel "${channel.title}" and all its posts?`}
          fields={{ op: 'deleteChannel', ...id }}
        />
      </div>
    </li>
  );
}

function StaffRow({ communityId, tick }: { communityId: string; tick: StaffTick }) {
  return (
    <li className={styles.channelRow}>
      <Text>{tick.name}</Text>
      <Badge tone="neutral">{tick.role}</Badge>
      <CommunityForm
        inline
        variant={tick.ticked ? 'secondary' : 'primary'}
        submit={tick.ticked ? 'Remove access' : 'Give access'}
        fields={{ op: 'setStaff', communityId, profileId: tick.profileId, on: String(!tick.ticked) }}
      />
    </li>
  );
}

export function CommunityEditor({ view }: { view: StudioCommunity }) {
  const { community, channels, staff, canManageStaff } = view;
  const communityId = community.id;
  return (
    <Stack gap="loose">
      <CommunityForm fields={{ op: 'updateCommunity', communityId }} submit="Save community">
        <Field label="Title">
          <Input name="title" defaultValue={community.title} required />
        </Field>
        <Field label="Subtitle">
          <Input name="subtitle" defaultValue={community.subtitle ?? ''} />
        </Field>
        <StatusSelect value={community.status} />
      </CommunityForm>

      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Channels
        </Heading>
        <ul aria-label="Channels" className={styles.rows}>
          {channels.map((c, i) => (
            <ChannelRow key={c.id} channel={c} first={i === 0} last={i === channels.length - 1} />
          ))}
        </ul>
        <CommunityForm inline fields={{ op: 'createChannel', communityId }} submit="Add channel">
          <Field label="New channel title">
            <Input name="title" required />
          </Field>
          <VisibilitySelect value="public" />
        </CommunityForm>
      </Stack>

      {canManageStaff ? (
        <Stack gap="base">
          <Heading level={2} variant="subtitle">
            Staff access
          </Heading>
          <Text tone="muted">Owners and admins reach every community. Assistants and support only where given access.</Text>
          {staff.length === 0 ? (
            <Text tone="muted">No assistants or support staff yet.</Text>
          ) : (
            <ul aria-label="Staff" className={styles.rows}>
              {staff.map((t) => (
                <StaffRow key={t.profileId} communityId={communityId} tick={t} />
              ))}
            </ul>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
