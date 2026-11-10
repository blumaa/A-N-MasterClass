import { describe, expect, it } from 'vitest';
import { downloadCommandFromForm } from './downloadsFromForm';

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const parse = (fields: Record<string, string>) => downloadCommandFromForm(form(fields));

describe('downloadCommandFromForm', () => {
  it('reads a new download product and a product patch', () => {
    expect(parse({ op: 'createDownload', title: 'Knot Sheets', slug: '' })).toEqual({
      ok: true,
      command: { op: 'createDownload', title: 'Knot Sheets', slug: 'knot-sheets' },
    });
    expect(parse({ op: 'updateProduct', productId: 'p', title: 'T', subtitle: '', status: 'published' })).toMatchObject({
      ok: true,
      command: { op: 'updateProduct', productId: 'p', patch: { title: 'T', status: 'published' } },
    });
  });

  it('reads file adds, renames and deletes', () => {
    expect(parse({ op: 'addFile', productId: 'p', title: 'Tie', filePath: 'p/tie.pdf', sizeBytes: '900' })).toEqual({
      ok: true,
      command: { op: 'addFile', productId: 'p', title: 'Tie', filePath: 'p/tie.pdf', sizeBytes: 900 },
    });
    expect(parse({ op: 'renameFile', fileId: 'f', title: 'New' })).toEqual({ ok: true, command: { op: 'renameFile', fileId: 'f', title: 'New' } });
    expect(parse({ op: 'deleteFile', fileId: 'f' })).toEqual({ ok: true, command: { op: 'deleteFile', fileId: 'f' } });
  });

  it('refuses a bad size or unknown op', () => {
    expect(parse({ op: 'addFile', productId: 'p', title: 'Tie', filePath: 'p/tie.pdf', sizeBytes: 'big' })).toMatchObject({ ok: false });
    expect(parse({ op: 'nope' })).toMatchObject({ ok: false });
  });
});
