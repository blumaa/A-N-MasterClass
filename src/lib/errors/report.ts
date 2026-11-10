// Single sink for errors that are handled (the user sees a state for them) but must still be
// seen by us. Takes the error only: member-authored text must not reach logs (check:errors).
export function reportError(error: unknown): void {
  console.error(error);
}
