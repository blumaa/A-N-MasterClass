// Member data rights (G25): JSON export of this space's data and account delete. Owners cannot
// delete here; the space needs an owner.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { ButtonLink } from '@/components/ui/links';
import { Heading, Stack, Text } from '@/components/ui/mds';
import { OWNER_CANNOT_DELETE } from '../api/memberData';

type Props = { exportHref: string; deleteAction: FormAction; spaceName: string; canDelete: boolean };

export function YourData({ exportHref, deleteAction, spaceName, canDelete }: Props) {
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Your data
      </Heading>
      <Text variant="note">Download everything you added to {spaceName}, or delete your account here.</Text>
      <div>
        <ButtonLink href={exportHref} variant="secondary" size="sm" download>
          Download my data
        </ButtonLink>
      </div>
      {canDelete ? (
        <ActionForm
          action={deleteAction}
          fields={{}}
          submit="Delete my account"
          variant="danger"
          confirm={`Delete your account at ${spaceName}? Your profile, posts, messages and progress here are removed for good. Purchases stay on record without your name.`}
        />
      ) : (
        <Text variant="note">{OWNER_CANNOT_DELETE}</Text>
      )}
    </Stack>
  );
}
