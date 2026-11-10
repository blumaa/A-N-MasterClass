const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Human file size, decimal units (1 KB = 1000 B, as macOS Finder shows). */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

/** Upper-case extension of a path ("PDF"), or "FILE" when it has none. */
export function fileType(path: string): string {
  const name = path.split('/').at(-1) ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : 'FILE';
}

/** Download name: the title plus the stored file's extension, unless the title already has it. */
export function downloadName(title: string, path: string): string {
  const type = fileType(path);
  if (type === 'FILE') return title;
  const ext = `.${type.toLowerCase()}`;
  return title.toLowerCase().endsWith(ext) ? title : `${title}${ext}`;
}
