// Up/down reorder for one row of a list: icon buttons that post `direction` with the row's fields.
import type { ComponentType } from 'react';
import type { ActionFormProps } from '@/components/ActionForm/ActionForm';

type Props = {
  /** The feature's ActionForm wrapper (bound to its Server Action). */
  form: ComponentType<Omit<ActionFormProps, 'action'>>;
  fields: Record<string, string>;
  first: boolean;
  last: boolean;
};

export function MoveButtons({ form: Form, fields, first, last }: Props) {
  return (
    <>
      {first ? null : <Form inline variant="ghost" icon="arrow-up" submit="Move up" fields={{ ...fields, direction: 'up' }} />}
      {last ? null : <Form inline variant="ghost" icon="arrow-down" submit="Move down" fields={{ ...fields, direction: 'down' }} />}
    </>
  );
}
