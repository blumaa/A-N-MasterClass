'use client';
// Email + password sign-in. Errors come back from the Server Action; success redirects.
import { useActionState } from 'react';
import { Button, Field, Input, Stack, Text } from '@/components/ui/mds';
import { signInAction } from '../actions';
import styles from './AuthForm.module.css';

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <form action={action} className={styles.form}>
      <Stack gap="base">
        <Field label="Email">
          <Input type="email" name="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input type="password" name="password" autoComplete="current-password" required />
        </Field>
        {state ? (
          <Text role="alert" tone="danger" variant="note">
            {state.message}
          </Text>
        ) : null}
        <div>
          <Button type="submit" loading={pending}>
            Sign in
          </Button>
        </div>
      </Stack>
    </form>
  );
}
