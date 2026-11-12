// Storage keys for uploaded files: `<spaceId>/<productId>/<id>-<safe name>`. SSOT for where an
// upload lands and for the check that a saved path belongs to the product (and so the space).

const MAX_STEM = 80;

const slug = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Lower-case, dash-separated base name with its extension; no folders. "file" when nothing is left. */
export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).at(-1) ?? '';
  const dot = base.lastIndexOf('.');
  const hasExt = dot > 0;
  const stem = slug(hasExt ? base.slice(0, dot) : base).slice(0, MAX_STEM).replace(/-+$/, '') || 'file';
  const ext = hasExt ? slug(base.slice(dot + 1)).replace(/-/g, '') : '';
  return ext ? `${stem}.${ext}` : stem;
}

const productFolder = (spaceId: string, productId: string) => `${spaceId}/${productId}/`;

export type UploadPathInput = { spaceId: string; productId: string; id: string; fileName: string };

export const uploadPath = ({ spaceId, productId, id, fileName }: UploadPathInput): string =>
  `${productFolder(spaceId, productId)}${id}-${safeFileName(fileName)}`;

/** True when `path` is one object directly in the product's folder of that space. */
export function isProductPath(path: string, spaceId: string, productId: string): boolean {
  const folder = productFolder(spaceId, productId);
  if (!path.startsWith(folder)) return false;
  const rest = path.slice(folder.length);
  return rest.length > 0 && !rest.includes('/');
}
