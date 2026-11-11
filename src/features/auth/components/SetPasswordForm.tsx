'use client';
// Set or change the password of the signed-in account (after checkout or a claim link, G4).
import { useActionState } from 'react';
import { Button, Field, Input, Stack, Text } from '@/components/ui/mds';
import { setPasswordAction } from '../actions';
import { MIN_PASSWORD_LENGTH } from '../forms';
import styles from './AuthForm.module.css';

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPasswordAction, null);
  return (
    <form action={action} className={styles.form}>
      <Stack gap="base">
        <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          <Input type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
        </Field>
        <Field label="Repeat password">
          <Input type="password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
        </Field>
        {state ? (
          <Text role="alert" tone="danger" variant="note">
            {state.message}
          </Text>
        ) : null}
        <div>
          <Button type="submit" loading={pending}>
            Save password
          </Button>
        </div>
      </Stack>
    </form>
  );
}
