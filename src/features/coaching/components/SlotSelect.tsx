// Open slots as one select, grouped by day in the client's zone. Posts the UTC instant as `slot`.
import { Field, Select } from '@/components/ui/mds';
import { slotDays } from '../display';

type Props = { slots: readonly Date[]; timeZone: string; coachZone: string };

export function SlotSelect({ slots, timeZone, coachZone }: Props) {
  const hint = timeZone === coachZone ? undefined : `Shown in your time zone. The coach works in ${coachZone}.`;
  return (
    <Field label={`Time (${timeZone})`} hint={hint}>
      <Select name="slot" required>
        {slotDays(slots, timeZone).map((day) => (
          <optgroup key={day.label} label={day.label}>
            {day.slots.map((s) => (
              <option key={s.iso} value={s.iso}>
                {`${day.label}, ${s.time}`}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  );
}
