// Platform home: every space + create a space with its owner (G1).
import { Heading, Stack } from '@/components/ui/mds';
import { platformSpaces } from '@/features/platform/api/spaces';
import { NewSpaceForm } from '@/features/platform/components/ClaimForms';
import { SpacesTable } from '@/features/platform/components/SpacesTable';
import { getRepo } from '@/lib/data/getRepo';
import { requirePlatformAdmin } from './guard';

export default async function PlatformHome() {
  await requirePlatformAdmin();
  const spaces = await platformSpaces(getRepo());
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Spaces
      </Heading>
      <SpacesTable spaces={spaces} />
      <Stack as="section" gap="base" aria-label="New space">
        <Heading level={2} variant="subtitle">
          New space
        </Heading>
        <NewSpaceForm />
      </Stack>
    </Stack>
  );
}
