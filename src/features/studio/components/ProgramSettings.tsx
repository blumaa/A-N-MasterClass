// Program title, subtitle, publish state, cover, completion certificate (G26).
import { YesNoSelect } from '@/components/fields/fields';
import type { Product } from '@/lib/data/types';
import { CommandForm } from './CommandForm';
import { ProductFields, type ImageSrc } from '@/components/ProductFields/ProductFields';

export function ProgramSettings({ program, imageSrc }: { program: Product; imageSrc: ImageSrc }) {
  return (
    <CommandForm fields={{ op: 'updateProgram', programId: program.id }} submit="Save program">
      <ProductFields product={program} imageSrc={imageSrc} />
      <YesNoSelect
        name="certificates"
        label="Certificate"
        value={program.certificates}
        yes="Give a certificate at 100% completion"
        no="Off"
      />
    </CommandForm>
  );
}
