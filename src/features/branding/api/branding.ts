// Branding DAL. Reads are public (every visitor gets the space theme); writes check
// capability (G15), shape and the MDS contrast contract before touching the repo.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import type { Repo } from '@/lib/data/repo';
import { isFontId } from '@/lib/fonts/catalog';
import type { BrandColors } from '@/tokens/resolveBrand';
import { contrastFailures } from '../contrast';
import { parseBrandColors, type Theme } from '../theme';

const DEFAULTS: Theme = { colors: null, fontHeading: null, fontBody: null };

export async function spaceTheme(repo: Repo, spaceId: string): Promise<Theme> {
  const row = await repo.branding(spaceId);
  return row ? { colors: row.colors, fontHeading: row.fontHeading, fontBody: row.fontBody } : DEFAULTS;
}

/** Override colours for a program route, looked up within the space (never across). */
export async function programTheme(repo: Repo, spaceId: string, slug: string): Promise<BrandColors | null> {
  const product = await repo.productBySlug(spaceId, slug);
  return product?.kind === 'program' ? product.themeOverride : null;
}

export async function studioBranding(repo: Repo, viewer: Viewer): Promise<Theme | null> {
  return viewerCan(viewer, 'branding.manage') ? spaceTheme(repo, viewer.space.id) : null;
}

export type BrandingInput = { colors: unknown; fontHeading: unknown; fontBody: unknown };

type Checked<T> = { ok: true; value: T } | { ok: false; error: 'invalid'; message: string };
const invalid = (message: string) => ({ ok: false as const, error: 'invalid' as const, message });

function checkColors(colors: unknown): Checked<BrandColors | null> {
  if (colors === null) return { ok: true, value: null };
  const parsed = parseBrandColors(colors);
  if (!parsed) return invalid('Every brand colour must be a #rrggbb value.');
  const failures = contrastFailures(parsed);
  if (failures.length) {
    const f = failures[0]!;
    return invalid(
      `Not enough contrast: ${f.fg} on ${f.bg} is ${f.ratio.toFixed(2)}:1, needs ${f.min}:1 (${failures.length} pair(s) fail).`,
    );
  }
  return { ok: true, value: parsed };
}

const checkFont = (font: unknown) => font === null || isFontId(font);

export async function saveBranding(repo: Repo, viewer: Viewer, input: BrandingInput): Promise<CommandResult> {
  if (!viewerCan(viewer, 'branding.manage')) return { ok: false, error: 'forbidden' };
  if (!checkFont(input.fontHeading) || !checkFont(input.fontBody)) return invalid('Pick a font from the list.');
  const colors = checkColors(input.colors);
  if (!colors.ok) return colors;
  await repo.saveBranding({
    spaceId: viewer.space.id,
    colors: colors.value,
    fontHeading: input.fontHeading as Theme['fontHeading'],
    fontBody: input.fontBody as Theme['fontBody'],
  });
  return { ok: true };
}

export async function saveProgramTheme(
  repo: Repo,
  viewer: Viewer,
  productId: string,
  colors: unknown,
): Promise<CommandResult> {
  if (!viewerCan(viewer, 'products.edit')) return { ok: false, error: 'forbidden' };
  const product = await repo.product(productId);
  if (!product || product.spaceId !== viewer.space.id || product.kind !== 'program') {
    return { ok: false, error: 'not_found' };
  }
  const checked = checkColors(colors);
  if (!checked.ok) return checked;
  await repo.updateProduct(productId, { themeOverride: checked.value });
  return { ok: true };
}
