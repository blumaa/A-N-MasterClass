// Studio > Branding: space logo (header) and browser icon. The page injects imageSrc
// (siteImageSrc) so this stays free of server config.
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { ImageUpload } from '@/components/ImageUpload/ImageUpload';
import type { BrandMarks } from '../api/branding';

type Props = { action: FormAction; marks: BrandMarks; imageSrc: (path: string) => string };

const current = (path: string | null, imageSrc: Props['imageSrc']) => (path ? { path, src: imageSrc(path) } : undefined);

export function BrandMarksForm({ action, marks, imageSrc }: Props) {
  return (
    <ActionForm action={action} fields={{}} submit="Save logo and icon" variant="primary">
      <ImageUpload name="logoPath" label="Logo (shown in the header instead of the name)" current={current(marks.logoPath, imageSrc)} />
      <ImageUpload name="faviconPath" label="Browser icon (square, at least 512 × 512)" current={current(marks.faviconPath, imageSrc)} />
    </ActionForm>
  );
}
