// Member upload ticket (G0, Kajabi: photos in posts, files in chat). Checks the viewer may post in
// the channel (rules.post) or reply in the DM thread (canReply), and the file kind: feed channels
// take photos, chat channels and DMs take attachments. Signs an upload into the channel or thread
// folder; the DB checks the folder again when the row is written.
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import { communityFilePath, communityFileProblem } from '@/lib/storage/communityFiles';
import type { FileStore } from '@/lib/storage/fileStore';
import type { UploadTicket } from '@/lib/storage/requestUpload';
import { channelScope } from './access';
import { canReply, otherOf, threadScope } from './chat';
import { channelFolderOf, threadFolderOf } from './files';

export type CommunityUploadRequest = {
  target: 'channel' | 'thread';
  /** Channel id or DM thread id. */
  id: string;
  fileName: string;
  type: string;
  sizeBytes: number;
};

export const NO_COMMUNITY_UPLOAD = 'You cannot add files here.';
const fail = (message: string): UploadTicket => ({ ok: false, message });

const wellFormed = (r: CommunityUploadRequest): boolean =>
  (r?.target === 'channel' || r?.target === 'thread') &&
  typeof r.id === 'string' &&
  typeof r.fileName === 'string' &&
  typeof r.type === 'string' &&
  Number.isSafeInteger(r.sizeBytes);

type Place = { folder: string; kind: 'photo' | 'attachment' };

async function placeOf(repo: Repo, viewer: Viewer, req: CommunityUploadRequest, now: Date): Promise<Place | null> {
  if (req.target === 'channel') {
    const found = await channelScope(repo, viewer, req.id, now);
    if (!found?.rules.post) return null;
    return { folder: channelFolderOf(found.community, found.channel.id), kind: found.channel.kind === 'feed' ? 'photo' : 'attachment' };
  }
  const found = await threadScope(repo, viewer, req.id, now);
  if (!found || !canReply(found.dm, viewer.profile!.id, otherOf(found.thread, viewer.profile!.id))) return null;
  return { folder: threadFolderOf(found.dm.community, found.thread), kind: 'attachment' };
}

export async function requestCommunityUpload(
  repo: Repo,
  files: FileStore,
  viewer: Viewer,
  req: CommunityUploadRequest,
  newId: () => string,
  now: Date,
): Promise<UploadTicket> {
  if (!viewer.profile) return fail(NO_COMMUNITY_UPLOAD);
  if (!wellFormed(req)) return fail('Invalid upload request.');
  const place = await placeOf(repo, viewer, req, now);
  if (!place) return fail(NO_COMMUNITY_UPLOAD);
  const problem = communityFileProblem(place.kind, req.type, req.sizeBytes);
  if (problem) return fail(problem);
  const path = communityFilePath(place.folder, newId(), req.fileName);
  return { ok: true, uploadUrl: await files.uploadUrl(path), path };
}
