'use client';
// Forms answered with an owner claim link: new space, fresh claim link for an existing space.
import { useActionState, type ReactNode } from 'react';
import { Button, Field, Input, Select, Stack, Text } from '@/components/ui/mds';
import { platformClaimAction } from '../actions';
import { ClaimLink } from './ClaimLink';
import styles from './Platform.module.css';

function ClaimForm({ op, submit, children }: { op: string; submit: string; children: ReactNode }) {
  const [state, action, pending] = useActionState(platformClaimAction, null);
  return (
    <Stack gap="base">
      <form action={action}>
        <Stack gap="base">
          <input type="hidden" name="op" value={op} />
          {children}
          <div>
            <Button type="submit" size="sm" loading={pending}>
              {submit}
            </Button>
          </div>
        </Stack>
      </form>
      {state && 'message' in state ? (
        <Text role="alert" tone="danger" variant="note">
          {state.message}
        </Text>
      ) : null}
      {state && 'claimUrl' in state ? <ClaimLink slug={state.slug} claimUrl={state.claimUrl} /> : null}
    </Stack>
  );
}

export function NewSpaceForm() {
  return (
    <ClaimForm op="create" submit="Create space">
      <div className={styles.row}>
        <Field label="Space name">
          <Input name="name" required />
        </Field>
        <Field label="Address (slug)" hint="Blank = made from the name">
          <Input name="slug" />
        </Field>
      </div>
      <div className={styles.row}>
        <Field label="Owner email">
          <Input type="email" name="ownerEmail" required />
        </Field>
        <Field label="Owner name">
          <Input name="ownerName" required />
        </Field>
        <Field label="Test space">
          <Select name="isTest" defaultValue="true">
            <option value="true">Yes (kept out of revenue)</option>
            <option value="false">No</option>
          </Select>
        </Field>
      </div>
    </ClaimForm>
  );
}

export function OwnerClaimForm({ slug }: { slug: string }) {
  return (
    <ClaimForm op="ownerClaim" submit="New owner sign-in link">
      <input type="hidden" name="slug" value={slug} />
    </ClaimForm>
  );
}
