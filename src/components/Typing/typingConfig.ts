// Server side: is typing on for this page? Only on Supabase data (fake mode has no Realtime)
// and only for a signed-in viewer. `people` = names the page already has; never sent.
import { dataSource } from '@/config/dataSource';

export type TypingPerson = { id: string; name: string };
export type TypingConfig = { topic: string; me: string; people: readonly TypingPerson[] };

export function typingConfig(topic: string, me: string | null, people: readonly TypingPerson[]): TypingConfig | null {
  if (dataSource() !== 'supabase' || me === null) return null;
  return { topic, me, people };
}
