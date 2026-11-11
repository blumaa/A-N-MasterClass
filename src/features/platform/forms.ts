// Platform admin forms (G1): create a space with its owner, change status, attach/detach a domain,
// issue a fresh owner claim link. Commands on an existing space name it by slug.
import { SPACE_STATUSES, type SpaceStatus } from '@/lib/data/types';
import { flag, parser } from '@/lib/forms/commands';
import { FormError, type FormReader } from '@/lib/forms/formReader';
import { isValidSlug } from '@/lib/tenancy/slug';
import { isEmail, normalizeEmail } from '@/lib/text/email';
import { slugify } from '@/lib/text/slugify';

export type NewSpaceInput = { name: string; slug: string; ownerEmail: string; ownerName: string; isTest: boolean };

export type PlatformCommand =
  | ({ op: 'create' } & NewSpaceInput)
  | { op: 'setStatus'; slug: string; status: SpaceStatus }
  | { op: 'addDomain'; slug: string; host: string; isPrimary: boolean }
  | { op: 'removeDomain'; slug: string; host: string }
  | { op: 'ownerClaim'; slug: string };

/** Bare host with at least one dot: labels of letters, digits, inner hyphens. */
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function readHost(r: FormReader): string {
  const host = (r.raw('host') ?? '').toLowerCase();
  if (!DOMAIN.test(host)) throw new FormError('Enter a domain like courses.example.com (no https:// or path).');
  return host;
}

function newSpace(r: FormReader): NewSpaceInput {
  const name = r.required('name');
  const slug = r.raw('slug') || slugify(name);
  if (!isValidSlug(slug)) {
    throw new FormError('Use lowercase letters, digits and hyphens for the address (not www, staging, platform or api).');
  }
  const ownerEmail = normalizeEmail(r.raw('ownerEmail') ?? '');
  if (!isEmail(ownerEmail)) throw new FormError('Enter the owner’s email.');
  return { name, slug, ownerEmail, ownerName: r.required('ownerName'), isTest: flag(r, 'isTest') };
}

export const parsePlatformCommand = parser<PlatformCommand>({
  create: (r) => ({ op: 'create', ...newSpace(r) }),
  setStatus: (r) => ({ op: 'setStatus', slug: r.required('slug'), status: r.oneOf('status', SPACE_STATUSES) }),
  addDomain: (r) => ({ op: 'addDomain', slug: r.required('slug'), host: readHost(r), isPrimary: flag(r, 'isPrimary') }),
  removeDomain: (r) => ({ op: 'removeDomain', slug: r.required('slug'), host: readHost(r) }),
  ownerClaim: (r) => ({ op: 'ownerClaim', slug: r.required('slug') }),
});
