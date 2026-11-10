'use server';
// One Server Action for every Studio site form. Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { editSite } from './api/site';
import { studioPageHref, studioSiteHref } from './paths';
import { siteCommandFromForm } from './siteCommandFromForm';

export type SiteEditState = { message: string } | null;

const FORBIDDEN = 'You do not have permission to edit the site.';

export async function editSiteAction(_prev: SiteEditState, form: FormData): Promise<SiteEditState> {
  const parsed = siteCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: FORBIDDEN };

  const { command } = parsed;
  const result = await editSite(getRepo(), viewer, command, new Date());
  if (!result.ok) return { message: failureMessage(result, FORBIDDEN) };
  if (command.op === 'createPage' && result.id) redirect(studioPageHref(result.id));
  if (command.op === 'deletePage') redirect(studioSiteHref);
  // TODO(supabase): revalidateTag for the space's public pages once ISR is on (pages render dynamically now).
  refresh();
  return null;
}
