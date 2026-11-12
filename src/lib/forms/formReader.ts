// Typed reads from FormData for Server Actions. Throws FormError with a user-facing message.
export class FormError extends Error {}

export function formReader(form: FormData) {
  const raw = (name: string): string | undefined => {
    const v = form.get(name);
    return typeof v === 'string' ? v.trim() : undefined;
  };
  const required = (name: string): string => {
    const v = raw(name);
    if (!v) throw new FormError(`Missing ${name}.`);
    return v;
  };
  const oneOf = <T extends string>(name: string, allowed: readonly T[]): T => {
    const v = required(name);
    if (!(allowed as readonly string[]).includes(v)) throw new FormError(`Unknown ${name}: ${v}.`);
    return v as T;
  };
  /** Every non-blank string value of a repeated field, trimmed. */
  const all = (name: string): string[] =>
    form.getAll(name).flatMap((v) => (typeof v === 'string' && v.trim() ? [v.trim()] : []));
  return { raw, required, oneOf, all };
}

export type FormReader = ReturnType<typeof formReader>;

/** Optional patch field: absent = untouched, '' = null. */
export function optional<K extends string, T>(r: FormReader, name: K, parse: (v: string) => T): Partial<Record<K, T | null>> {
  const v = r.raw(name);
  if (v === undefined) return {};
  return { [name]: v === '' ? null : parse(v) } as Partial<Record<K, T | null>>;
}

/** Runs a parser, turning FormError into a result. Other errors propagate. */
export function parseForm<T>(parse: () => T): { ok: true; value: T } | { ok: false; message: string } {
  try {
    return { ok: true, value: parse() };
  } catch (err) {
    if (err instanceof FormError) return { ok: false, message: err.message };
    throw err;
  }
}
