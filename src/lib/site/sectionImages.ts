// Image paths stored in sections -> public URLs. URLs are built on the server (the storage
// origin is server config) and handed to renderers and editors as a lookup.
import { SECTION_SPECS, type FieldSpec, type SiteSection } from './sections';

export type ImageUrls = Record<string, string>;

const imageNames = (fields: readonly FieldSpec[] | undefined) => (fields ?? []).filter((f) => f.type === 'image').map((f) => f.name);

export function sectionImages(sections: readonly SiteSection[], toUrl: (path: string) => string): ImageUrls {
  const out: ImageUrls = {};
  for (const s of sections) {
    const spec = SECTION_SPECS[s.kind];
    const rows = [s.fields, ...(spec.item ? s.items : [])];
    const names = [...imageNames(spec.fields), ...imageNames(spec.item?.fields)];
    for (const row of rows) {
      for (const name of names) {
        const path = row[name];
        if (path) out[path] = toUrl(path);
      }
    }
  }
  return out;
}
