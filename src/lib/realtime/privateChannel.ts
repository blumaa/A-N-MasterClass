// Private Realtime channel helper. Join is authorised by RLS on realtime.messages
// (public.can_join_live), so a topic only reaches users who may read what it names.
// Docs: https://supabase.com/docs/guides/realtime/authorization
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { reportError } from '@/lib/errors/report';
import { LIVE_EVENT } from './topics';

export type RealtimeHost = Pick<SupabaseClient, 'channel' | 'removeChannel' | 'realtime'>;

/**
 * Opens `topic` as a private channel. `bind` attaches listeners (broadcast now; presence later).
 * Auth is set before subscribe (Supabase docs). `onJoin` runs once joined (send only after it).
 * Returns close; safe before the join finishes.
 */
export function privateChannel(
  host: RealtimeHost,
  topic: string,
  bind: (channel: RealtimeChannel) => void,
  onJoin?: () => void,
): () => void {
  const channel = host.channel(topic, { config: { private: true } });
  bind(channel);
  let closed = false;
  host.realtime
    .setAuth()
    .then(() => {
      if (closed) return;
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') onJoin?.();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reportError(err ?? new Error(`realtime ${status} on ${topic}`));
      });
    })
    .catch(reportError);
  return () => {
    closed = true;
    void host.removeChannel(channel);
  };
}

/** Invalidate only: calls `onStale` for each stale hint and never hands it the payload. */
export function listenStale(host: RealtimeHost, topic: string, onStale: () => void): () => void {
  return privateChannel(host, topic, (channel) => {
    channel.on('broadcast', { event: LIVE_EVENT }, () => onStale());
  });
}
