// Open slots as one select, grouped by day in the coach's zone. Posts the UTC instant as `slot`.
import { Field, Select } from '@/components/ui/mds';
import { slotDays } from '../display';

export function SlotSelect({ slots, timeZone }: { slots: readonly Date[]; timeZone: string }) {
  return (
    <Field label={`Time (${timeZone})`}>
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
