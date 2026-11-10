// Studio > one community: settings, channels, access groups + messaging, staff ticks (G15).
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';
import { ButtonLink } from '@/components/ui/links';
import { Badge, Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import type { StaffTick, StudioCommunity } from '../api/studio';
import { studioEventsHref } from '../paths';
import { ChannelEditor } from './ChannelEditor';
import { CommunityForm } from './CommunityForm';
import { GroupEditor } from './GroupEditor';
import { PointsEditor } from './PointsEditor';
import styles from './community.module.css';

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
  const { community, channels, groups, members, channelMembers, staff, canManageStaff } = view;
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

      <ChannelEditor
        communityId={communityId}
        channels={channels}
        groups={groups}
        members={members}
        channelMembers={channelMembers}
      />
      <GroupEditor communityId={communityId} groups={groups} settings={view.settings} />
      <PointsEditor communityId={communityId} settings={view.settings} />
      <div>
        <ButtonLink href={studioEventsHref(communityId)} variant="secondary">
          Challenges and meetups
        </ButtonLink>
      </div>

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
