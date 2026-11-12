// Browser paths (host-relative; the proxy adds the space segment). SSOT for program links.
export { libraryHref } from '@/lib/routes';
export const programHref = (program: string): string => `/programs/${program}`;
export const stepHref = (program: string, step: string): string => `/programs/${program}/${step}`;
/** Download part file: route checks step access, then 302 to a signed URL. */
export const partFileHref = (program: string, step: string, part: string): string => `${stepHref(program, step)}/files/${part}`;
