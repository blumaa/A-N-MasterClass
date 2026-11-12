// Picked people (channel members, channel moderators, approval list): remove picked, add from non-staff.
import { Field, Select, Stack, Text } from '@/components/ui/mds';
import type { DirectoryEntry } from '../api/feed';
import { CommunityForm } from './CommunityForm';
import styles from './community.module.css';

export type PickerText = { list: string; empty: string; field: string; add: string };

type Props = {
  text: PickerText;
  /** Form fields naming the op and its scope; profileId and on are added here. */
  base: Readonly<Record<string, string>>;
  candidates: readonly DirectoryEntry[];
  picked: readonly string[];
};

export function PeoplePicker({ text, base, candidates, picked }: Props) {
  const ids = new Set(picked);
  const inside = candidates.filter((m) => ids.has(m.id));
  const outside = candidates.filter((m) => !ids.has(m.id) && !m.staff);
  return (
    <Stack gap="tight">
      {inside.length === 0 ? (
        <Text tone="muted">{text.empty}</Text>
      ) : (
        <ul aria-label={text.list} className={styles.rows}>
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
