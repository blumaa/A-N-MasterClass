// Member push settings: one switch per notification type, saved together.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { Heading, Stack, Switch, Text } from '@/components/ui/mds';
import type { PushTypeSetting } from '../api/pushSettings';
import { PUSH_TYPE_LABELS } from './labels';

export function PushTypeSettings({ settings, action }: { settings: readonly PushTypeSetting[]; action: FormAction }) {
  return (
    <Stack gap="tight">
      <Heading level={2} variant="subtitle">
        Push me about
      </Heading>
      <Text variant="note" tone="muted">
        For every device with push on. Notifications still show here.
      </Text>
      <ActionForm action={action} fields={{}} submit="Save push settings" done="Push settings saved">
        {settings.map((s) => (
          <Switch key={s.type} name="on" value={s.type} defaultChecked={s.on} label={PUSH_TYPE_LABELS[s.type]} />
        ))}
      </ActionForm>
    </Stack>
  );
}
