// Site DAL (G11, G25): public reads of published pages, Studio reads and one command
// entry point. Every command checks site.edit (G15) and that the page lives in the
// viewer's space (tenant wall before RLS). Status is derived: published !== null.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Direction, Repo } from '@/lib/data/repo';
import type { LegalKind, NavItem, Page, PageKind, PageVersion, Space } from '@/lib/data/types';
import { LEGAL_KINDS } from '@/lib/data/types';
import { formatMoney } from '@/lib/commerce/money';
import { checkoutPath } from '@/lib/commerce/paths';
import {
  SECTION_SPECS,
  isRefType,
  newSection,
  validateSection,
  type RefType,
  type SectionChoices,
  type SectionKind,
  type SiteSection,
} from '@/lib/site/sections';
import { sectionImages, type ImageUrls } from '@/lib/site/sectionImages';
import { SLUG_PATTERN } from '@/lib/tenancy/slug';
import { pageHref } from '../paths';
import { LEGAL_LABELS, RESERVED_PAGE_SLUGS, checkNav, legalGaps } from '../rules';

// ---------- public reads ----------

export type PublicPage = { page: Page; sections: SiteSection[] };

const live = (page: Page | null | undefined): PublicPage | null =>
  page?.published ? { page, sections: page.published.filter((s) => !s.hidden) } : null;

export async function homePage(repo: Repo, spaceId: string): Promise<PublicPage | null> {
  return live((await repo.pages(spaceId)).find((p) => p.isHome));
}

export async function publicPage(repo: Repo, spaceId: string, slug: string): Promise<PublicPage | null> {
  return live(await repo.pageBySlug(spaceId, 'page', slug));
}

export async function publicPost(repo: Repo, spaceId: string, slug: string): Promise<PublicPage | null> {
  return live(await repo.pageBySlug(spaceId, 'post', slug));
}

export async function blogPosts(repo: Repo, spaceId: string): Promise<Page[]> {
  return (await repo.pages(spaceId))
    .filter((p) => p.kind === 'post' && p.published && p.publishedAt)
    .toSorted((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());
}

export type SiteChrome = { header: NavItem[]; footer: NavItem[]; legal: NavItem[] };

/** Header + footer links; published legal pages are pinned in the footer (G25). */
export async function siteChrome(repo: Repo, spaceId: string): Promise<SiteChrome> {
  const [nav, pages] = await Promise.all([repo.siteNav(spaceId), repo.pages(spaceId)]);
  const legal = LEGAL_KINDS.flatMap((kind) => {
    const p = pages.find((x) => x.legalKind === kind && x.published);
    return p ? [{ label: LEGAL_LABELS[kind], href: pageHref(p) }] : [];
  });
  return { header: nav.header, footer: nav.footer, legal };
}

export type CurriculumPreview = { title: string; modules: { title: string; steps: string[] }[] };
export type OfferPreview = { title: string; description: string | null; price: string; href: string };
export type SectionRefs = {
  curricula: Record<string, CurriculumPreview>;
  offers: Record<string, OfferPreview>;
  /** Stored image path -> public URL. */
  images: ImageUrls;
};

/** Distinct non-empty slugs the sections' ref fields of one type point at. */
function refSlugs(sections: readonly SiteSection[], type: RefType): string[] {
  const slugs = new Set<string>();
  for (const s of sections) {
    for (const f of SECTION_SPECS[s.kind].fields) {
      const slug = s.fields[f.name];
      if (f.type === type && slug) slugs.add(slug);
    }
  }
  return [...slugs];
}

async function bySlug<T>(slugs: readonly string[], find: (slug: string) => Promise<T | null>): Promise<Record<string, T>> {
  const entries = await Promise.all(slugs.map(async (slug) => [slug, await find(slug)] as const));
  return Object.fromEntries(entries.filter((e): e is readonly [string, Awaited<T>] => e[1] !== null));
}

/** What curriculum, offer and image fields show: published programs and offers of this space only. */
export async function sectionRefs(
  repo: Repo,
  space: Pick<Space, 'id' | 'locale'>,
  sections: readonly SiteSection[],
  imageUrl: (path: string) => string,
): Promise<SectionRefs> {
  const [curricula, offers] = await Promise.all([
    bySlug(refSlugs(sections, 'program'), (slug) => outline(repo, space.id, slug)),
    bySlug(refSlugs(sections, 'offer'), (slug) => offerPreview(repo, space, slug)),
  ]);
  return { curricula, offers, images: sectionImages(sections, imageUrl) };
}

async function offerPreview(repo: Repo, space: Pick<Space, 'id' | 'locale'>, slug: string): Promise<OfferPreview | null> {
  const offer = await repo.offerBySlug(space.id, slug);
  if (offer?.status !== 'published') return null;
  return {
    title: offer.title,
    description: offer.description,
    price: formatMoney(offer.priceCents, offer.currency, space.locale),
    href: checkoutPath(offer.slug),
  };
}

async function outline(repo: Repo, spaceId: string, slug: string): Promise<CurriculumPreview | null> {
  const program = slug ? await repo.productBySlug(spaceId, slug) : null;
  if (program?.kind !== 'program' || program.status !== 'published') return null;
  const modules = (await repo.modules(program.id)).filter((m) => m.status === 'published');
  const steps = (await repo.steps(modules.map((m) => m.id))).filter((s) => s.status === 'published');
  return {
    title: program.title,
    modules: modules.map((m) => ({ title: m.title, steps: steps.filter((s) => s.moduleId === m.id).map((s) => s.title) })),
  };
}

// ---------- studio reads ----------

export type StudioSite = { pages: Page[]; posts: Page[]; legalGaps: LegalKind[]; header: NavItem[]; footer: NavItem[] };

export async function studioSite(repo: Repo, viewer: Viewer): Promise<StudioSite | null> {
  if (!viewerCan(viewer, 'site.edit')) return null;
  const [all, nav] = await Promise.all([repo.pages(viewer.space.id), repo.siteNav(viewer.space.id)]);
  return {
    pages: all.filter((p) => p.kind === 'page'),
    posts: all.filter((p) => p.kind === 'post'),
    legalGaps: legalGaps(all),
    header: nav.header,
    footer: nav.footer,
  };
}

export async function studioPage(
  repo: Repo,
  viewer: Viewer,
  pageId: string,
): Promise<{ page: Page; versions: PageVersion[] } | null> {
  if (!viewerCan(viewer, 'site.edit')) return null;
  const page = await repo.page(pageId);
  if (!page || page.spaceId !== viewer.space.id) return null;
  return { page, versions: await repo.pageVersions(pageId) };
}

/** Studio preview: the draft as visitors would see it once published (hidden sections dropped). */
export async function draftPreview(repo: Repo, viewer: Viewer, pageId: string): Promise<PublicPage | null> {
  const found = await studioPage(repo, viewer, pageId);
  return found && { page: found.page, sections: found.page.draft.filter((s) => !s.hidden) };
}

/** Records the ref fields of a section may point at (any status: link first, publish later). */
export async function sectionChoices(repo: Repo, spaceId: string): Promise<SectionChoices> {
  const [products, offers] = await Promise.all([repo.products(spaceId), repo.offers(spaceId)]);
  const choice = ({ slug, title }: { slug: string; title: string }) => ({ slug, title });
  return { program: products.filter((p) => p.kind === 'program').map(choice), offer: offers.map(choice) };
}

// ---------- commands ----------

type SectionRef = { pageId: string; sectionId: string };

export type SiteCommand =
  | { op: 'createPage'; kind: PageKind; title: string; slug: string }
  | {
      op: 'updatePage';
      pageId: string;
      title: string;
      slug: string;
      seoTitle: string | null;
      seoDescription: string | null;
      isHome: boolean;
      legalKind: LegalKind | null;
    }
  | { op: 'deletePage'; pageId: string }
  | { op: 'addSection'; pageId: string; kind: SectionKind }
  | ({ op: 'updateSection'; fields: Record<string, string>; items: Record<string, string>[] } & SectionRef)
  | ({ op: 'removeSection' | 'duplicateSection' | 'toggleSection' } & SectionRef)
  | ({ op: 'moveSection'; direction: Direction } & SectionRef)
  | { op: 'publish' | 'unpublish'; pageId: string }
  | { op: 'restoreVersion'; pageId: string; versionId: string }
  | { op: 'saveNav'; header: NavItem[]; footer: NavItem[] };

const OK: CommandResult = { ok: true };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };
const invalid = (message: string): CommandResult => ({ ok: false, error: 'invalid', message });

function slugProblem(kind: PageKind, slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) return 'Use lowercase letters, numbers and dashes for the address.';
  if (kind === 'page' && RESERVED_PAGE_SLUGS.includes(slug)) return `"${slug}" is used by the site itself. Pick another address.`;
  return null;
}

export async function editSite(
  repo: Repo,
  viewer: Viewer,
  cmd: SiteCommand,
  now: Date,
  newId: () => string = () => crypto.randomUUID(),
): Promise<CommandResult> {
  if (!viewerCan(viewer, 'site.edit')) return { ok: false, error: 'forbidden' };
  const spaceId = viewer.space.id;
  try {
    if (cmd.op === 'saveNav') return await saveNav(repo, spaceId, cmd.header, cmd.footer);
    if (cmd.op === 'createPage') {
      const title = cmd.title.trim();
      if (!title) return invalid('Title is required.');
      const problem = slugProblem(cmd.kind, cmd.slug);
      if (problem) return invalid(problem);
      const page = await repo.createPage({ spaceId, kind: cmd.kind, title, slug: cmd.slug });
      return { ok: true, id: page.id };
    }

    const page = await repo.page(cmd.pageId);
    if (!page || page.spaceId !== spaceId) return NOT_FOUND;

    switch (cmd.op) {
      case 'updatePage':
        return await updatePage(repo, page, cmd);
      case 'deletePage':
        await repo.deletePage(page.id);
        return OK;
      case 'addSection':
        await repo.updatePage(page.id, { draft: [...page.draft, newSection(cmd.kind, newId())] });
        return OK;
      case 'publish':
        return await publish(repo, page, now);
      case 'unpublish':
        await repo.updatePage(page.id, { published: null, publishedAt: null });
        return OK;
      case 'restoreVersion': {
        const version = (await repo.pageVersions(page.id)).find((v) => v.id === cmd.versionId);
        if (!version) return NOT_FOUND;
        await repo.updatePage(page.id, { draft: version.sections });
        return OK;
      }
      default:
        return await editSection(repo, page, cmd, newId);
    }
  } catch (e) {
    if (e instanceof ConstraintError) return invalid(e.message);
    throw e;
  }
}

async function updatePage(repo: Repo, page: Page, cmd: Extract<SiteCommand, { op: 'updatePage' }>): Promise<CommandResult> {
  const title = cmd.title.trim();
  if (!title) return invalid('Title is required.');
  const problem = slugProblem(page.kind, cmd.slug);
  if (problem) return invalid(problem);
  if (page.kind === 'post' && (cmd.isHome || cmd.legalKind)) return invalid('Only pages can be the home page or a legal page.');
  const others = (await repo.pages(page.spaceId)).filter((p) => p.id !== page.id);
  if (cmd.legalKind && others.some((p) => p.legalKind === cmd.legalKind)) {
    return invalid(`Another page is already the ${LEGAL_LABELS[cmd.legalKind]}.`);
  }
  // One home per space: clear the old one first. TODO(supabase): single RPC for atomicity.
  if (cmd.isHome) for (const p of others.filter((x) => x.isHome)) await repo.updatePage(p.id, { isHome: false });
  await repo.updatePage(page.id, {
    title,
    slug: cmd.slug,
    seoTitle: cmd.seoTitle?.trim() || null,
    seoDescription: cmd.seoDescription?.trim() || null,
    isHome: cmd.isHome,
    legalKind: cmd.legalKind,
  });
  return OK;
}

async function publish(repo: Repo, page: Page, now: Date): Promise<CommandResult> {
  if (!page.draft.some((s) => !s.hidden)) return invalid('Add at least one visible section before publishing.');
  if (page.isHome) {
    const gaps = legalGaps(await repo.pages(page.spaceId));
    if (gaps.length) {
      return invalid(`Publish these pages before the home page: ${gaps.map((k) => LEGAL_LABELS[k]).join(', ')}.`);
    }
  }
  await repo.updatePage(page.id, { published: page.draft, publishedAt: now });
  await repo.addPageVersion({ pageId: page.id, sections: page.draft, publishedAt: now });
  return OK;
}

async function editSection(
  repo: Repo,
  page: Page,
  cmd: Extract<SiteCommand, SectionRef>,
  newId: () => string,
): Promise<CommandResult> {
  const draft = [...page.draft];
  const i = draft.findIndex((s) => s.id === cmd.sectionId);
  const section = draft[i];
  if (!section) return NOT_FOUND;

  switch (cmd.op) {
    case 'updateSection': {
      const checked = validateSection(section, cmd.fields, cmd.items, page.spaceId);
      if (!checked.ok) return invalid(checked.message);
      const problem = await refProblem(repo, page.spaceId, checked.section);
      if (problem) return invalid(problem);
      draft[i] = checked.section;
      break;
    }
    case 'removeSection':
      draft.splice(i, 1);
      break;
    case 'duplicateSection':
      draft.splice(i + 1, 0, { ...structuredClone(section), id: newId() });
      break;
    case 'toggleSection':
      draft[i] = { ...section, hidden: !section.hidden };
      break;
    case 'moveSection': {
      const j = cmd.direction === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= draft.length) return OK;
      [draft[i], draft[j]] = [draft[j]!, section];
      break;
    }
  }
  await repo.updatePage(page.id, { draft });
  return OK;
}

const REF_EXISTS: Record<RefType, (repo: Repo, spaceId: string, slug: string) => Promise<boolean>> = {
  program: async (repo, spaceId, slug) => (await repo.productBySlug(spaceId, slug))?.kind === 'program',
  offer: async (repo, spaceId, slug) => (await repo.offerBySlug(spaceId, slug)) !== null,
};
const REF_PROBLEM: Record<RefType, string> = {
  program: 'Pick a program from the list.',
  offer: 'Pick an offer from the list.',
};

/** Ref fields must name a record of this space (tenant wall). */
async function refProblem(repo: Repo, spaceId: string, section: SiteSection): Promise<string | null> {
  for (const f of SECTION_SPECS[section.kind].fields) {
    const slug = section.fields[f.name];
    if (isRefType(f.type) && slug && !(await REF_EXISTS[f.type](repo, spaceId, slug))) return REF_PROBLEM[f.type];
  }
  return null;
}

async function saveNav(repo: Repo, spaceId: string, header: NavItem[], footer: NavItem[]): Promise<CommandResult> {
  const h = checkNav(header);
  if (!h.ok) return invalid(`Header: ${h.message}`);
  const f = checkNav(footer);
  if (!f.ok) return invalid(`Footer: ${f.message}`);
  await repo.saveSiteNav({ spaceId, header: h.items, footer: f.items });
  return OK;
}
