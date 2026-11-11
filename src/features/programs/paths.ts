// Browser paths (host-relative; the proxy adds the space segment). SSOT for program links.
export { libraryHref } from '@/lib/routes';
export const programHref = (program: string): string => `/programs/${program}`;
export const stepHref = (program: string, step: string): string => `/programs/${program}/${step}`;
