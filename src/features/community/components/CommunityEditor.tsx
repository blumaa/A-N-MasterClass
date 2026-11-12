// Studio > one community: settings, channels, access groups + messaging, staff ticks (G15).
import { ROLE_LABELS } from '@/lib/labels';
import { ProductFields, type ImageSrc } from '@/components/ProductFields/ProductFields';
import { ButtonLink } from '@/components/ui/links';
import { Badge, Heading, Stack, Text } from '@/components/ui/mds';
import type { StaffTick, StudioCommunity } from '../api/studio';
import { studioEventsHref, studioReportsHref } from '../paths';
import { ChannelEditor } from './ChannelEditor';
import { CommunityForm } from './CommunityForm';
import { GroupEditor } from './GroupEditor';
import { PointsEditor } from './PointsEditor';
import styles from './community.module.css';

function StaffRow({ communityId, tick }: { communityId: string; tick: StaffTick }) {
  return (
    <li className={styles.channelRow}>
      <Text>{tick.name}</Text>
      <Badge tone="neutral">{ROLE_LABELS[tick.role]}</Badge>
      <CommunityForm
        inline
        variant={tick.ticked ? 'secondary' : 'primary'}
        submit={tick.ticked ? 'Remove access' : 'Give access'}
        fields={{ op: 'setStaff', communityId, profileId: tick.profileId, on: String(!tick.ticked) }}
      />
    </li>
  );
}

export function CommunityEditor({ view, imageSrc }: { view: StudioCommunity; imageSrc: ImageSrc }) {
  const { community, channels, groups, members, channelMembers, channelModerators, staff, canManageStaff, canModerate } = view;
  const communityId = community.id;
  return (
    <Stack gap="loose">
      <CommunityForm fields={{ op: 'updateCommunity', communityId }} submit="Save community">
        <ProductFields product={community} imageSrc={imageSrc} />
      </CommunityForm>

      <ChannelEditor
        communityId={communityId}
        channels={channels}
        groups={groups}
        members={members}
        channelMembers={channelMembers}
        channelModerators={canModerate ? channelModerators : null}
      />
      <GroupEditor communityId={communityId} groups={groups} settings={view.settings} />
      <PointsEditor communityId={communityId} settings={view.settings} />
      <div className={styles.rowActions}>
        <ButtonLink href={studioEventsHref(communityId)} variant="secondary">
          Challenges and meetups
        </ButtonLink>
        {canModerate ? (
          <ButtonLink href={studioReportsHref(communityId)} variant="secondary">
            Reports
          </ButtonLink>
        ) : null}
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
