// Fields every product settings form shares: title, subtitle, status, cover. Read by productPatch().
import { Field, Input } from '@/components/ui/mds';
import { StatusSelect } from '@/components/StatusSelect/StatusSelect';
import type { Product } from '@/lib/data/types';
import { CoverField, type ImageSrc } from './CoverField';

export type { ImageSrc };

export function ProductFields({ product, imageSrc }: { product: Product; imageSrc: ImageSrc }) {
  return (
    <>
      <Field label="Title">
        <Input name="title" defaultValue={product.title} required />
      </Field>
      <Field label="Subtitle">
        <Input name="subtitle" defaultValue={product.subtitle ?? ''} />
      </Field>
      <StatusSelect value={product.status} />
      <CoverField path={product.coverPath} imageSrc={imageSrc} />
    </>
  );
}
