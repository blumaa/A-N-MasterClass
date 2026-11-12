// Product cover image field: posts `coverPath`, read by coverField() in every product patch.
// The page injects imageSrc (siteImageSrc) so this stays free of server config.
import { ImageUpload } from '@/components/ImageUpload/ImageUpload';

export type ImageSrc = (path: string) => string;

export function CoverField({ path, imageSrc }: { path: string | null; imageSrc: ImageSrc }) {
  return <ImageUpload name="coverPath" label="Cover image" current={path ? { path, src: imageSrc(path) } : undefined} />;
}
