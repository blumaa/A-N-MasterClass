// One content block on a step (G6): fields by kind, reorder, delete.
// Download: file goes straight to Storage in the program folder (FileUpload); the form saves path + size.
// Quiz: pass mark here, questions in QuizEditor (G26).
import { FileUpload } from '@/components/FileUpload/FileUpload';
import { Badge, Card, CardBody, Field, Input, Stack, Textarea } from '@/components/ui/mds';
import type { Part } from '@/lib/data/types';
import type { EditorQuestion } from '../api/curriculum';
import { CommandForm } from './CommandForm';
import { MoveButtons } from '@/components/MoveButtons/MoveButtons';
import { QuizEditor } from './QuizEditor';
import { PART_KIND_LABELS } from '../partKinds';
import styles from './Curriculum.module.css';

function KindFields({ part, programId }: { part: Part; programId: string }) {
  switch (part.kind) {
    case 'video':
      return (
        <Field label="Vimeo link" hint="Paste the video link or its number.">
          <Input name="video" defaultValue={part.vimeoId ?? ''} />
        </Field>
      );
    case 'download':
      return (
        <FileUpload
          productId={programId}
          kind="program"
          label={part.filePath ? 'Replace the file' : 'Choose or drop a file'}
          pathName="filePath"
          sizeName="fileSize"
          current={part.filePath ? { path: part.filePath, bytes: part.fileSize ?? 0 } : undefined}
        />
      );
    case 'quiz':
      return (
        <Field label="Pass mark (%)" hint="Blank = any attempt passes.">
          <Input name="passPercent" type="number" min={1} max={100} defaultValue={part.passPercent ?? ''} />
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

type Props = { programId: string; part: Part; first: boolean; last: boolean; questions?: EditorQuestion[] };

export function PartEditor({ programId, part, first, last, questions = [] }: Props) {
  return (
    <Card variant="sunken">
      <CardBody>
        <Stack gap="tight">
          <div className={styles.head}>
            <Badge tone="neutral">{PART_KIND_LABELS[part.kind]}</Badge>
            <MoveButtons form={CommandForm} fields={{ op: 'move', table: 'parts', id: part.id }} first={first} last={last} />
          </div>
          <CommandForm fields={{ op: 'updatePart', partId: part.id }} submit="Save block">
            <Field label="Title" hint="Optional.">
              <Input name="title" defaultValue={part.title ?? ''} />
            </Field>
            <KindFields part={part} programId={programId} />
          </CommandForm>
          {part.kind === 'quiz' ? <QuizEditor partId={part.id} questions={questions} /> : null}
          <CommandForm
            inline
            variant="ghost"
            fields={{ op: 'deletePart', partId: part.id }}
            submit="Delete block"
            confirm="Delete this block?"
          />
        </Stack>
      </CardBody>
    </Card>
  );
}
