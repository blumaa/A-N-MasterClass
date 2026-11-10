// One toggle per allowed emoji. Count shown when > 0; the viewer's own reactions are highlighted.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { REACTION_EMOJIS } from '@/lib/data/types';
import type { ReactionCount } from '../api/present';
import styles from './community.module.css';

type Props = {
  action: FormAction;
  targetType: 'post' | 'comment';
  targetId: string;
  reactions: readonly ReactionCount[];
  enabled: boolean;
};

export function ReactionBar({ action, targetType, targetId, reactions, enabled }: Props) {
  const byEmoji = new Map(reactions.map((r) => [r.emoji, r]));
  if (!enabled) {
    if (reactions.length === 0) return null;
    return (
      <div className={styles.reactions}>
        {reactions.map((r) => (
          <span key={r.emoji}>{`${r.emoji} ${r.count}`}</span>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.reactions}>
      {REACTION_EMOJIS.map((emoji) => {
        const r = byEmoji.get(emoji);
        return (
          <ActionForm
            key={emoji}
            action={action}
            inline
            variant={r?.mine ? 'secondary' : 'ghost'}
            submit={r ? `${emoji} ${r.count}` : emoji}
            fields={{ op: 'react', targetType, targetId, emoji, on: String(!r?.mine) }}
          />
        );
      })}
    </div>
  );
}
