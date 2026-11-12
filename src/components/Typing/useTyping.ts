'use client';
// Typing indicator state for one topic. Receives others' typing (never self, unknown ids dropped,
// expiry after TYPING_TTL_MS); sends the viewer's own, throttled. Null config = off.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browserClient } from '@/lib/realtime/browserClient';
import { TYPING_EVENTS } from '@/lib/realtime/topics';
import { dropTyper, markTyper, nextExpiry, pruneTypers, shouldSend, typingLine, type Typers } from '@/lib/realtime/typing';
import { joinTyping, type TypingLink } from '@/lib/realtime/typingChannel';
import type { TypingConfig, TypingPerson } from './typingConfig';

export type Typing = {
  /** "X is typing…" or '' */
  line: string;
  /** Call on each edit. */
  typed: () => void;
  /** Call on send and blur. Unmount stops by itself. */
  stop: () => void;
};

const NONE: Typers = new Map();
const NOBODY: readonly TypingPerson[] = [];

export function useTyping(config: TypingConfig | null): Typing {
  const topic = config?.topic ?? null;
  const me = config?.me ?? null;
  const people = config?.people ?? NOBODY;
  const [typers, setTypers] = useState<Typers>(NONE);
  const link = useRef<TypingLink | null>(null);
  const lastSent = useRef<number | null>(null);

  useEffect(() => {
    if (topic === null || me === null) return;
    const joined = joinTyping(browserClient(), topic, (event, id) => {
      if (id === me) return;
      setTypers((t) => (event === TYPING_EVENTS.start ? markTyper(t, id, Date.now()) : dropTyper(t, id)));
    });
    link.current = joined;
    return () => {
      if (lastSent.current !== null) joined.send(TYPING_EVENTS.stop, me);
      lastSent.current = null;
      link.current = null;
      joined.close();
      setTypers(NONE);
    };
  }, [topic, me]);

  useEffect(() => {
    const at = nextExpiry(typers);
    if (at === null) return;
    const timer = setTimeout(() => setTypers((t) => pruneTypers(t, Date.now())), Math.max(0, at - Date.now()));
    return () => clearTimeout(timer);
  }, [typers]);

  const typed = useCallback(() => {
    const now = Date.now();
    if (me === null || !shouldSend(lastSent.current, now)) return;
    lastSent.current = now;
    link.current?.send(TYPING_EVENTS.start, me);
  }, [me]);

  const stop = useCallback(() => {
    if (me === null || lastSent.current === null) return;
    lastSent.current = null;
    link.current?.send(TYPING_EVENTS.stop, me);
  }, [me]);

  const names = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const line = typingLine([...typers.keys()].flatMap((id) => names.get(id) ?? []));
  return { line, typed, stop };
}
