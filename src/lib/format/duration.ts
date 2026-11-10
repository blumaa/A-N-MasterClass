const pad = (n: number): string => String(n).padStart(2, '0');

/** Episode length as m:ss, or h:mm:ss from an hour on (the form readDuration accepts back). */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
