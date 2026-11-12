// Checks shared by the fake challenges and meetups. Same constraints as the events migrations.
import { ConstraintError, INVALID_REPEAT } from '../errors';
import { REPEAT_COUNT_MAX, REPEAT_EVERY_MAX, REPEAT_FREQS, type Challenge, type Repeat } from '../types';
import type { Db } from './db';

export const DESCRIPTION_MAX = 10_000;
export const VIMEO_ID = /^[0-9]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Title, window, description, group of the community. */
export function checkEvent(
  db: Db,
  row: Pick<Challenge, 'communityId' | 'accessGroupId' | 'title' | 'description' | 'startsAt' | 'endsAt'>,
): void {
  if (row.title.trim().length === 0) throw new ConstraintError('title required');
  if (row.description.length > DESCRIPTION_MAX) throw new ConstraintError('description too long');
  if (row.endsAt <= row.startsAt) throw new ConstraintError('end must be after start');
  const group = db.accessGroups.find((g) => g.id === row.accessGroupId);
  if (!group || group.communityId !== row.communityId) throw new ConstraintError('group must belong to the community');
}

/** Mirror of meetups_repeat / meetups_repeat_freq. */
export function checkRepeat(r: Repeat | null): void {
  if (r === null) return;
  const ok =
    REPEAT_FREQS.includes(r.freq) &&
    Number.isInteger(r.every) &&
    r.every >= 1 &&
    r.every <= REPEAT_EVERY_MAX &&
    (r.count === null || r.until === null) &&
    (r.count === null || (Number.isInteger(r.count) && r.count >= 1 && r.count <= REPEAT_COUNT_MAX)) &&
    (r.until === null || ISO_DATE.test(r.until)) &&
    (r.freq === 'weekly' || r.days.length === 0) &&
    r.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (!ok) throw new ConstraintError(INVALID_REPEAT);
}
