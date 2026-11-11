'use client';
// One-time owner sign-in link (G4) to copy and send by hand until transactional email exists.
import { AppLink } from '@/components/ui/links';
import { Field, Input, Stack, Text } from '@/components/ui/mds';
import { platformSpaceHref } from '../paths';

export function ClaimLink({ slug, claimUrl }: { slug: string; claimUrl: string }) {
  return (
    <Stack gap="tight">
      <Field label="Owner sign-in link">
        <Input readOnly value={claimUrl} onFocus={(e) => e.currentTarget.select()} />
      </Field>
      <Text variant="note" tone="secondary">
        Send this link to the owner. It works once and expires in 10 days.
      </Text>
      <AppLink href={platformSpaceHref(slug)}>Manage {slug}</AppLink>
    </Stack>
  );
}
