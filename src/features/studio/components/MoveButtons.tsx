// Up/down reorder for one row (swap with sibling, repo.move).
import { CommandForm } from './CommandForm';

type Props = { table: 'modules' | 'steps' | 'parts'; id: string; first: boolean; last: boolean };

export function MoveButtons({ table, id, first, last }: Props) {
  return (
    <>
      {first ? null : <CommandForm inline variant="ghost" submit="Move up" fields={{ op: 'move', table, id, direction: 'up' }} />}
      {last ? null : <CommandForm inline variant="ghost" submit="Move down" fields={{ op: 'move', table, id, direction: 'down' }} />}
    </>
  );
}
