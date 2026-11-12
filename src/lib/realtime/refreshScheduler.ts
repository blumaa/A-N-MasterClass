// Turns "something changed" pokes into server refreshes.
// Burst = one refresh per window. Hidden tab = no refresh; one on return if anything changed.

export const REFRESH_DEBOUNCE_MS = 300;

export type RefreshScheduler = {
  /** Something shown is stale. */
  poke(): void;
  /** Tab became visible. */
  visible(): void;
  dispose(): void;
};

type Options = { refresh: () => void; isVisible: () => boolean };

export function createRefreshScheduler({ refresh, isVisible }: Options): RefreshScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;

  const fire = () => {
    timer = null;
    if (isVisible()) refresh();
    else pending = true;
  };

  return {
    poke() {
      if (!isVisible()) pending = true;
      else timer ??= setTimeout(fire, REFRESH_DEBOUNCE_MS);
    },
    visible() {
      if (!pending || !isVisible()) return;
      pending = false;
      refresh();
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = false;
    },
  };
}
