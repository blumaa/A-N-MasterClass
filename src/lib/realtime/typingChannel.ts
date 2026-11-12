// Typing over a private broadcast topic (Launch 6 item 7). Join = read right, send = post right
// (RLS: public.can_join_live / can_send_live). Payload = typer's profile id, never a name or text.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { reportError } from '@/lib/errors/report';
import { privateChannel, type RealtimeHost } from './privateChannel';
import { TYPING_EVENTS, type TypingEvent } from './topics';

export type TypingLink = {
  /** Dropped until joined: typing is ephemeral, no REST fallback. */
  send: (event: TypingEvent, profileId: string) => void;
  close: () => void;
};

const profileIdOf = (payload: unknown): string | null => {
  const id = (payload as { profileId?: unknown } | undefined)?.profileId;
  return typeof id === 'string' ? id : null;
};

export function joinTyping(host: RealtimeHost, topic: string, on: (event: TypingEvent, profileId: string) => void): TypingLink {
  let channel: RealtimeChannel | null = null;
  let joined = false;
  const close = privateChannel(
    host,
    topic,
    (c) => {
      channel = c;
      for (const event of Object.values(TYPING_EVENTS)) {
        c.on('broadcast', { event }, ({ payload }) => {
          const id = profileIdOf(payload);
          if (id) on(event, id);
        });
      }
    },
    () => (joined = true),
  );
  return {
    send: (event, profileId) => {
      if (!joined || !channel) return;
      void channel.send({ type: 'broadcast', event, payload: { profileId } }).then((result) => {
        if (result !== 'ok') reportError(new Error(`typing send ${result} on ${topic}`));
      });
    },
    close,
  };
}
