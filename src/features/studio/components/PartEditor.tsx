// One content block on a step (G6): fields by kind, reorder, delete.
import { Badge, Card, CardBody, Field, Input, Stack, Textarea } from '@/components/ui/mds';
import type { Part } from '@/lib/data/types';
import { CommandForm } from './CommandForm';
import { MoveButtons } from './MoveButtons';
import styles from './Curriculum.module.css';

function KindFields({ part }: { part: Part }) {
  switch (part.kind) {
    case 'video':
      return (
        <Field label="Vimeo link" hint="Paste the video link or its number.">
          <Input name="video" defaultValue={part.vimeoId ?? ''} />
        </Field>
      );
    case 'download':
      // OWES: file upload to private `resources` bucket (Supabase Storage).
      return (
        <Field label="File path" hint="Upload arrives with storage. For now: path inside the resources bucket.">
          <Input name="filePath" defaultValue={part.filePath ?? ''} />
        </Field>
      );
    default:
      return (
        <Field label="Text">
          <Textarea name="text" rows={5} defaultValue={part.text ?? ''} />
        </Field>
      );
  }
}

export function PartEditor({ part, first, last }: { part: Part; first: boolean; last: boolean }) {
  return (
    <Card variant="sunken">
      <CardBody>
        <Stack gap="tight">
          <div className={styles.head}>
            <Badge tone="neutral">{part.kind}</Badge>
            <MoveButtons table="parts" id={part.id} first={first} last={last} />
          </div>
          <CommandForm fields={{ op: 'updatePart', partId: part.id }} submit="Save block">
            <Field label="Title" hint="Optional.">
              <Input name="title" defaultValue={part.title ?? ''} />
            </Field>
            <KindFields part={part} />
          </CommandForm>
          <CommandForm
            inline
            variant="danger"
            fields={{ op: 'deletePart', partId: part.id }}
            submit="Delete block"
            confirm="Delete this block?"
          />
        </Stack>
      </CardBody>
    </Card>
  );
}
