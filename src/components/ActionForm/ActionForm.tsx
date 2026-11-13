'use client';
// Form bound to one Server Action. Hidden fields carry ids; children are the inputs.
// Deterministic: no optimistic UI, the page refreshes from the server after the action.
// Errors show inline beside the inputs; success shows as a toast (returned message, else `done`).
// `confirm` asks first in the MDS ConfirmDialog (never window.confirm): it stays busy until the action
// settles and shows a failure inside the dialog.
import { useActionState, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, ConfirmDialog, Icon, Text, useToast } from '@/components/ui/mds';
import styles from './ActionForm.module.css';

/** A message is an error unless ok (then a success note). */
export type ActionState = { message: string; ok?: true } | null;
export type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Question asked before the action runs. Tone defaults to danger; cancelLabel to "Cancel"
 *  (name it when the action itself is a cancel, e.g. "Keep session"). */
export type Confirm = { title: string; description?: string; tone?: 'danger' | 'warning'; cancelLabel?: string };
type Settle = { resolve: () => void; reject: (error: Error) => void };

export type ActionFormProps = {
  action: FormAction;
  fields: Record<string, string>;
  submit: string;
  children?: ReactNode;
  confirm?: Confirm;
  /** Default: primary for a stacked form with inputs (an edit form's save), else secondary.
   *  danger = the one destructive action of a page; removing a row in a list uses ghost. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  inline?: boolean;
  /** Icon name (see Icons): shows an icon-only button; `submit` becomes its accessible name. */
  icon?: string;
  /** Toast shown when the action succeeds without a message. Omit for self-evident actions. */
  done?: string;
};

export function ActionForm({ action, fields, submit, children, confirm, variant, inline = false, icon, done }: ActionFormProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState(false);
  // Set while a confirmed submit runs: lets that submit through and tells the dialog how it ended.
  const settle = useRef<Settle | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const pendingSettle = settle.current;
    settle.current = null;
    let next: ActionState;
    try {
      next = await action(prev, form);
    } catch (error) {
      // Redirects throw too; the dialog closes and the throw goes on to Next.
      pendingSettle?.resolve();
      throw error;
    }
    const success = next === null ? done : next.ok ? next.message : undefined;
    if (success) toast({ title: success, tone: 'success' });
    if (next && !next.ok) pendingSettle?.reject(new Error(next.message));
    else pendingSettle?.resolve();
    return next;
  }, null);
  const onSubmit = (event: FormEvent) => {
    if (!confirm || settle.current) return;
    event.preventDefault();
    setAsking(true);
  };
  const runConfirmed = () =>
    new Promise<void>((resolve, reject) => {
      settle.current = { resolve, reject };
      formRef.current?.requestSubmit();
    });
  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={inline ? styles.inline : styles.stacked}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <div>
        {icon ? (
          <Button type="submit" variant={variant ?? 'ghost'} size="sm" loading={pending} iconOnly aria-label={submit}>
            <Icon name={icon} />
          </Button>
        ) : (
          <Button type="submit" variant={variant ?? (children && !inline ? 'primary' : 'secondary')} size="sm" loading={pending}>
            {submit}
          </Button>
        )}
      </div>
      {state && !state.ok ? (
        <Text role="alert" tone="danger" variant="note">
          {state.message}
        </Text>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          open={asking}
          onClose={() => setAsking(false)}
          onConfirm={runConfirmed}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={submit}
          cancelLabel={confirm.cancelLabel ?? 'Cancel'}
          tone={confirm.tone ?? 'danger'}
        />
      ) : null}
    </form>
  );
}
