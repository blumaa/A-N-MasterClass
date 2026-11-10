// What a student reads for a non-open step/module. Pure, unit-tested.
import type { StepAccess } from '@/lib/programs/access';

const DAY_MS = 86_400_000;

export function accessLabel(access: StepAccess, now: Date): string | null {
  switch (access.kind) {
    case 'open':
      return null;
    case 'hidden':
      return 'Draft';
    case 'no_grant':
      return 'Enrol to unlock';
    case 'locked':
      return 'Complete the previous lesson to unlock';
    case 'drip': {
      const days = Math.ceil((access.opensAt.getTime() - now.getTime()) / DAY_MS);
      return days <= 1 ? 'Opens tomorrow' : `Opens in ${days} days`;
    }
  }
}
