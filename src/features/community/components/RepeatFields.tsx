// Kajabi meetup "Repeat" (Launch 6 item 8): frequency, interval, weekdays (weekly only), and an
// end (never / after N times / on a date). Field names match readRepeat in eventsFromForm.
import { Checkbox, Field, Input } from '@/components/ui/mds';
import { ChoiceSelect } from '@/components/fields/fields';
import { REPEAT_COUNT_MAX, REPEAT_EVERY_MAX, type Repeat } from '@/lib/data/types';
import styles from './community.module.css';

const FREQS = ['none', 'daily', 'weekly', 'monthly'] as const;
const FREQ_LABELS = { none: 'Does not repeat', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly (same weekday)' };
const ENDS = ['never', 'count', 'until'] as const;
const END_LABELS = { never: 'Never', count: 'After a number of times', until: 'On a date' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function RepeatFields({ repeat }: { repeat?: Repeat | null }) {
  const end = repeat?.count != null ? 'count' : repeat?.until != null ? 'until' : 'never';
  return (
    <>
      <ChoiceSelect name="repeatFreq" label="Repeat" value={repeat?.freq ?? 'none'} options={FREQS} labels={FREQ_LABELS} />
      <Field label="Every (days, weeks or months)">
        <Input type="number" name="repeatEvery" min={1} max={REPEAT_EVERY_MAX} defaultValue={repeat?.every ?? 1} />
      </Field>
      <fieldset className={styles.weekdays}>
        <legend>Weekly on (the start day always counts)</legend>
        {WEEKDAYS.map((d, i) => (
          <Checkbox key={d} name="repeatDays" value={String(i + 1)} label={d} defaultChecked={repeat?.days.includes(i + 1)} />
        ))}
      </fieldset>
      <ChoiceSelect name="repeatEnd" label="Repeat ends" value={end} options={ENDS} labels={END_LABELS} />
      <Field label="Number of times">
        <Input type="number" name="repeatCount" min={1} max={REPEAT_COUNT_MAX} defaultValue={repeat?.count ?? undefined} />
      </Field>
      <Field label="End date">
        <Input type="date" name="repeatUntil" defaultValue={repeat?.until ?? undefined} />
      </Field>
    </>
  );
}
