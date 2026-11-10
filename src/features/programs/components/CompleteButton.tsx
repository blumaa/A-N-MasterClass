'use client';
// Complete & Continue (G7). Deterministic: no optimistic tick; server answers, page refreshes.
import { useActionState } from 'react';
import { Button, Text } from '@mond-design-system/react';
import { completeStepAction, type CompleteState } from '../actions';

const MESSAGES: Record<NonNullable<CompleteState>['error'], string> = {
  signed_out: 'Sign in to track your progress.',
  not_found: 'This lesson no longer exists.',
  not_open: 'This lesson is not open yet.',
};

type Props = { programSlug: string; stepId: string; done: boolean };

export function CompleteButton({ programSlug, stepId, done }: Props) {
  const [state, action, pending] = useActionState(completeStepAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="program" value={programSlug} />
      <input type="hidden" name="step" value={stepId} />
      <input type="hidden" name="done" value={String(!done)} />
      <Button type="submit" variant={done ? 'secondary' : 'primary'} loading={pending}>
        {done ? 'Mark as not complete' : 'Complete & Continue'}
      </Button>
      {state ? (
        <Text role="alert" tone="danger">
          {MESSAGES[state.error]}
        </Text>
      ) : null}
    </form>
  );
}
