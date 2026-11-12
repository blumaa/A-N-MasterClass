'use client';
// Platform > spaces list. Client: DataTable takes cell functions.
import { AppLink } from '@/components/ui/links';
import { Badge, DataTable, Inline } from '@/components/ui/mds';
import type { Space } from '@/lib/data/types';
import { platformSpaceHref } from '../paths';
import { SPACE_STATUS_LABELS } from '../spaceStatus';

export function SpacesTable({ spaces }: { spaces: Space[] }) {
  return (
    <DataTable<Space>
      label="Spaces"
      rows={spaces}
      rowKey={(s) => s.id}
      empty="No spaces yet."
      columns={[
        { key: 'name', header: 'Name', cell: (s) => <AppLink href={platformSpaceHref(s.slug)}>{s.name}</AppLink>, sortValue: (s) => s.name },
        { key: 'slug', header: 'Address', cell: (s) => s.slug, sortValue: (s) => s.slug },
        {
          key: 'status',
          header: 'Status',
          cell: (s) => (
            <Inline gap="tight">
              <span>{SPACE_STATUS_LABELS[s.status]}</span>
              {s.isTest ? <Badge tone="warning">Test</Badge> : null}
            </Inline>
          ),
          sortValue: (s) => s.status,
        },
      ]}
    />
  );
}
