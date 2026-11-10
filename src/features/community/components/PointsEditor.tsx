// Studio > community > gamification (Kajabi): points on/off, who sees the leaderboard and the
// points each action earns. https://help.kajabi.com/articles/products/community/community-settings-gamification
import { Field, Heading, Input, Stack, Text } from '@/components/ui/mds';
import { DEFAULT_POINT_VALUES, LEADERBOARD_VISIBILITIES, POINT_REASONS, POINT_VALUE_MAX, type CommunitySettings } from '@/lib/data/types';
import { CommunityForm } from './CommunityForm';
import { ChoiceSelect, YesNoSelect } from './fields';
import { LEADERBOARD_LABELS, POINT_REASON_LABELS } from './labels';

export function PointsEditor({ communityId, settings }: { communityId: string; settings: CommunitySettings }) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Points and leaderboard
      </Heading>
      <Text tone="muted">Points add up per member. Weekly boards reset Monday 08:00 UTC, monthly ones on the 1st.</Text>
      <CommunityForm fields={{ op: 'saveSettings', communityId }} submit="Save points">
        <YesNoSelect name="pointsEnabled" label="Points" value={settings.pointsEnabled} yes="On" no="Off" />
        <ChoiceSelect
          name="leaderboard"
          label="Leaderboard shown to"
          value={settings.leaderboard}
          options={LEADERBOARD_VISIBILITIES}
          labels={LEADERBOARD_LABELS}
        />
        {POINT_REASONS.map((reason) => (
          <Field key={reason} label={POINT_REASON_LABELS[reason]}>
            <Input
              name={`point_${reason}`}
              type="number"
              min={0}
              max={POINT_VALUE_MAX}
              step={1}
              defaultValue={String(settings.pointValues[reason] ?? DEFAULT_POINT_VALUES[reason])}
              required
            />
          </Field>
        ))}
      </CommunityForm>
    </Stack>
  );
}
