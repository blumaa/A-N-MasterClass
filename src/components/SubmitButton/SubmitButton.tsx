'use client';
// Submit button for a plain <form action>: shows the spinner while the form's action runs.
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/mds';

type Props = { children: ReactNode; variant?: ButtonProps['variant']; size?: ButtonProps['size'] };

export function SubmitButton({ children, variant, size }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} loading={pending}>
      {children}
    </Button>
  );
}
