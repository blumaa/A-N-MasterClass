// Subscription status words shown to members and in Studio (G5).
import type { SubscriptionStatus } from '@/lib/data/types';

const LABELS: Record<SubscriptionStatus, string> = {
  pending: 'pending',
  active: 'active',
  past_due: 'past due',
  cancelled: 'cancelled',
  completed: 'paid off',
};

export const subscriptionStatusLabel = (s: SubscriptionStatus): string => LABELS[s];
