// Browser paths (host-relative; the proxy adds the space segment). SSOT for download links.
export const downloadHref = (product: string): string => `/downloads/${product}`;
export const fileHref = (product: string, file: string): string => `${downloadHref(product)}/files/${file}`;
export const studioDownloadsHref = '/studio/downloads';
