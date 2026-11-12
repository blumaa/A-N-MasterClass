// Member's own profile in this space: photo, display name, bio (G2). The page injects
// imageSrc (siteImageSrc) so this stays free of server config.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { ImageUpload } from '@/components/ImageUpload/ImageUpload';
import { Field, Input, Textarea } from '@/components/ui/mds';
import type { SpaceProfile } from '@/lib/data/types';
import { BIO_MAX, NAME_MAX } from '../api/limits';

type Props = { action: FormAction; profile: SpaceProfile; imageSrc: (path: string) => string };

export function ProfileForm({ action, profile, imageSrc }: Props) {
  const current = profile.avatarPath ? { path: profile.avatarPath, src: imageSrc(profile.avatarPath) } : undefined;
  return (
    <ActionForm action={action} fields={{}} submit="Save profile" variant="primary">
      <ImageUpload name="avatarPath" label="Photo" target="avatar" current={current} />
      <Field label="Display name">
        <Input name="displayName" defaultValue={profile.displayName} maxLength={NAME_MAX} required />
      </Field>
      <Field label="Bio">
        <Textarea name="bio" rows={4} defaultValue={profile.bio ?? ''} maxLength={BIO_MAX} />
      </Field>
    </ActionForm>
  );
}
