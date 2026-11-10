// Start + end as datetime-local inputs in the chosen zone, plus the zone select. The server
// turns them back into UTC instants with the same zone (readInstant in lib/forms/commands).
import { Field, Input } from '@/components/ui/mds';
import { utcToZonedInput } from '@/lib/format/zoned';
import { TimeZoneSelect } from './fields';

type Props = { timeZone: string; startsAt?: Date; endsAt?: Date };

export function TimeFields({ timeZone, startsAt, endsAt }: Props) {
  return (
    <>
      <Field label="Starts">
        <Input type="datetime-local" name="startsAt" required defaultValue={startsAt ? utcToZonedInput(startsAt, timeZone) : undefined} />
      </Field>
      <Field label="Ends">
        <Input type="datetime-local" name="endsAt" required defaultValue={endsAt ? utcToZonedInput(endsAt, timeZone) : undefined} />
      </Field>
      <TimeZoneSelect value={timeZone} />
    </>
  );
}
