// Studio > Programs: list + create (Kajabi: new programs start as draft).
import { PublishStatusBadge } from '@/components/PublishStatusBadge/PublishStatusBadge';
import { EmptyState, Field, Input, ListGroup, Stack } from '@/components/ui/mds';
import { LinkRow } from '@/components/ui/links';
import type { Product } from '@/lib/data/types';
import { studioProgramHref } from '../paths';
import { CommandForm } from './CommandForm';

export function ProgramList({ programs }: { programs: Product[] }) {
  return (
    <Stack gap="loose">
      {programs.length === 0 ? (
        <EmptyState title="No programs yet" description="Create your first program below." />
      ) : (
        <ListGroup>
          {programs.map((p) => (
            <LinkRow
              key={p.id}
              title={p.title}
              description={p.subtitle ?? undefined}
              href={studioProgramHref(p.slug)}
              trailing={<PublishStatusBadge status={p.status} />}
            />
          ))}
        </ListGroup>
      )}
      <CommandForm fields={{ op: 'createProgram' }} submit="Create program">
        <Field label="Title">
          <Input name="title" required />
        </Field>
        <Field label="URL slug" hint="Leave blank to use the title.">
          <Input name="slug" pattern="[a-z0-9-]*" />
        </Field>
      </CommandForm>
    </Stack>
  );
}
