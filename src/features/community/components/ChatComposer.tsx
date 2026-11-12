'use client';
// Chat send box plus the typing line under it. Readers who may not send (composer null)
// still see who types. Typing null = off (fake mode, signed out).
import { TypingIndicator } from '@/components/Typing/TypingIndicator';
import type { TypingConfig } from '@/components/Typing/typingConfig';
import { useTyping } from '@/components/Typing/useTyping';
import { Composer, type ComposerProps } from './Composer';

type Props = { typing: TypingConfig | null; composer: ComposerProps | null };

export function ChatComposer({ typing, composer }: Props) {
  const { line, typed, stop } = useTyping(typing);
  return (
    <>
      {composer ? <Composer {...composer} onType={typed} onStop={stop} /> : null}
      {typing ? <TypingIndicator line={line} /> : null}
    </>
  );
}
