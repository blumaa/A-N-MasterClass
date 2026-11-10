// Outcome of a DAL command, shared by every feature's write entry point.
export type CommandResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'forbidden' | 'not_found' }
  | { ok: false; error: 'invalid'; message: string };

export type CommandFailure = Extract<CommandResult, { ok: false }>;

/** User-facing text for a failed command. `forbidden` names what the viewer may not do. */
export function failureMessage(result: CommandFailure, forbidden: string): string {
  if (result.error === 'invalid') return result.message;
  return result.error === 'forbidden' ? forbidden : 'Not found. It may have been deleted.';
}
