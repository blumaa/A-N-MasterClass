// One photo of a community post (?size=thumb: its thumbnail): read check on the post, then a 302 to a short-lived signed URL.
import type { NextRequest } from 'next/server';
import { postPhotoPath } from '@/features/community/api/fileAccess';
import { photoSize } from '@/features/community/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { signedRedirect } from '@/lib/storage/signedRedirect';

export async function GET(req: NextRequest, ctx: RouteContext<'/[space]/community/[community]/posts/[post]/photos/[photo]'>) {
  const { space, community, post, photo } = await ctx.params;
  const viewer = await currentViewer(space);
  const path = viewer && (await postPhotoPath(getRepo(), viewer, community, post, photo, photoSize(req.nextUrl.searchParams.get('size')), new Date()));
  return signedRedirect(path ? await getFileStore('community').signedUrl(path) : null);
}
