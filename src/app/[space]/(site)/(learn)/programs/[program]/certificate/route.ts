// Completion certificate PDF (G26). Built on the server per request; 404 unless the viewer earned it.
import { programCertificate } from '@/features/programs/api/certificate';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export async function GET(_req: Request, ctx: RouteContext<'/[space]/programs/[program]/certificate'>) {
  const { space, program } = await ctx.params;
  const viewer = await currentViewer(space);
  const file = viewer && (await programCertificate(getRepo(), viewer, program, new Date()));
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
