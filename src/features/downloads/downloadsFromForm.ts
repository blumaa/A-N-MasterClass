// Download studio forms -> commands. File size in bytes (whole number) until upload exists.
import { parser, productPatch, readWhole, titleAndSlug } from '@/lib/forms/commands';
import type { FormReader as Reader } from '@/lib/forms/formReader';
import type { DownloadCommand } from './api/studio';

const STUDIO: Record<DownloadCommand['op'], (r: Reader) => DownloadCommand> = {
  createDownload: (r) => ({ op: 'createDownload', ...titleAndSlug(r) }),
  updateProduct: (r) => ({ op: 'updateProduct', productId: r.required('productId'), patch: productPatch(r) }),
  addFile: (r) => ({
    op: 'addFile',
    productId: r.required('productId'),
    title: r.required('title'),
    filePath: r.required('filePath'),
    sizeBytes: readWhole(r, 'sizeBytes', 'file size'),
  }),
  renameFile: (r) => ({ op: 'renameFile', fileId: r.required('fileId'), title: r.required('title') }),
  deleteFile: (r) => ({ op: 'deleteFile', fileId: r.required('fileId') }),
};

export const downloadCommandFromForm = parser<DownloadCommand>(STUDIO);
