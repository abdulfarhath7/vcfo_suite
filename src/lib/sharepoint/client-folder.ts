import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getEngagementById, setSharepointFolder, type SharepointFolderLink } from '@/db/repositories/engagements';
import { getGraphFileAccess } from '@/db/repositories/outlook-connections';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { sharepointConfig } from './config';
import { GraphError, graphItem, graphItemByPath, graphListChildren, graphSiteDrives } from './graph';
import { libraryCandidates } from './library';
import { matchClientFolder, type FolderMatch } from './match';

/**
 * A project's SharePoint folder: find it under `/Clients`, link it, and check a stored link still
 * works. Every call starts from a scoped repository read, so a person reaches only the projects
 * they could open on screen, and reads SharePoint with their own token, so they see only the
 * folders SharePoint lets them open.
 */

export type SharepointRefusal =
  | 'not_configured'
  | 'not_connected'
  | 'reconnect'
  | 'no_project'
  | 'no_access'
  | 'no_clients_folder'
  | 'graph_failed';

export const SHAREPOINT_COPY: Record<SharepointRefusal, string> = {
  not_configured: 'SharePoint is not set up for this app yet. The firm admin needs to set the SharePoint site first.',
  not_connected: 'Connect Microsoft 365 in Settings, Email first. Then ask me again.',
  reconnect: 'Please reconnect Microsoft 365 in Settings, Email once, so I can read SharePoint files. Then ask me again.',
  no_project: 'That project is not available.',
  no_access: 'Your Microsoft 365 account cannot open the SharePoint site that holds the client folders.',
  no_clients_folder: 'I cannot find the Clients folder on the SharePoint site.',
  graph_failed: 'SharePoint did not answer just now. Please try again in a minute.',
};

export class SharepointRefused extends Error {
  constructor(readonly code: SharepointRefusal) {
    super(SHAREPOINT_COPY[code]);
    this.name = 'SharepointRefused';
  }
}

function graphRefusal(error: unknown, notFound: SharepointRefusal): SharepointRefused {
  if (error instanceof SharepointRefused) return error;
  if (error instanceof GraphError) {
    if (error.status === 401 || error.status === 403) return new SharepointRefused('no_access');
    if (error.status === 404) return new SharepointRefused(notFound);
  }
  console.error('[sharepoint] graph call failed', error instanceof Error ? error.message.slice(0, 200) : error);
  return new SharepointRefused('graph_failed');
}

export interface ClientsRoot {
  access: string;
  driveId: string;
  rootId: string;
}

/** The caller's token and the clients folder, or a refusal the chat and the settings can show. */
export async function openClientsRoot(ctx: AuthContext): Promise<ClientsRoot> {
  const cfg = sharepointConfig();
  if (!cfg) throw new SharepointRefused('not_configured');
  const token = await getGraphFileAccess(ctx);
  if (token.ok === false) throw new SharepointRefused(token.code);
  try {
    const site = await graphSiteDrives(token.access, cfg.hostname, cfg.sitePath);
    for (const { driveId, path } of libraryCandidates(cfg.clientsPath, site)) {
      try {
        const root = await graphItemByPath(token.access, driveId, path);
        if (root.folder) return { access: token.access, driveId, rootId: root.id };
      } catch (error) {
        // Not in this library; try the next reading of the path.
        if (!(error instanceof GraphError && error.status === 404)) throw error;
      }
    }
    throw new SharepointRefused('no_clients_folder');
  } catch (error) {
    throw graphRefusal(error, 'no_clients_folder');
  }
}

export interface ClientFolder {
  id: string;
  name: string;
}

/** The client folders directly under `/Clients`, in name order. */
export async function listClientFolders(root: ClientsRoot): Promise<ClientFolder[]> {
  try {
    const children = await graphListChildren(root.access, root.driveId, root.rootId);
    return children
      .filter((c) => c.folder)
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw graphRefusal(error, 'no_clients_folder');
  }
}

async function loadProject(ctx: AuthContext, engagementId: string) {
  const row = await getEngagementById(ctx, engagementDbId(engagementId));
  if (!row || row.deletedAt) throw new SharepointRefused('no_project');
  return row;
}

export type ProjectFolder =
  | { kind: 'linked'; link: SharepointFolderLink; root: ClientsRoot; companyName: string }
  | { kind: 'choose'; match: Exclude<FolderMatch<ClientFolder>, { kind: 'one' }>; companyName: string };

/**
 * The project's folder: the stored link when it still opens, else the one folder whose name matches
 * the client, which is then linked. Two or no matches come back as a choice for the person.
 */
export async function resolveProjectFolder(ctx: AuthContext, engagementId: string): Promise<ProjectFolder> {
  const row = await loadProject(ctx, engagementId);
  const root = await openClientsRoot(ctx);
  if (row.sharepointFolderId && row.sharepointDriveId === root.driveId) {
    try {
      const item = await graphItem(root.access, root.driveId, row.sharepointFolderId);
      if (item.folder) return { kind: 'linked', link: { driveId: root.driveId, folderId: item.id, folderName: item.name }, root, companyName: row.companyName };
    } catch (error) {
      // A folder that was deleted or moved out of reach is matched again below.
      if (!(error instanceof GraphError && error.status === 404)) throw graphRefusal(error, 'graph_failed');
    }
  }
  const folders = await listClientFolders(root);
  const match = matchClientFolder(row.companyName, folders);
  if (match.kind !== 'one') return { kind: 'choose', match, companyName: row.companyName };
  const link = { driveId: root.driveId, folderId: match.folder.id, folderName: match.folder.name };
  await setSharepointFolder(ctx, row.id, link);
  return { kind: 'linked', link, root, companyName: row.companyName };
}

/** Links the project to one of the folders under `/Clients`, or unlinks it with null. */
export async function linkProjectFolder(ctx: AuthContext, engagementId: string, folderId: string | null): Promise<SharepointFolderLink | null> {
  const row = await loadProject(ctx, engagementId);
  if (folderId === null) {
    await setSharepointFolder(ctx, row.id, null);
    return null;
  }
  const root = await openClientsRoot(ctx);
  // Only a folder directly under /Clients may be linked, so a link can never point elsewhere.
  const folder = (await listClientFolders(root)).find((f) => f.id === folderId);
  if (!folder) throw new SharepointRefused('no_clients_folder');
  const link = { driveId: root.driveId, folderId: folder.id, folderName: folder.name };
  await setSharepointFolder(ctx, row.id, link);
  return link;
}

/** What the project's settings show: the link, if any, and nothing that needs Graph. */
export async function projectFolderLink(ctx: AuthContext, engagementId: string): Promise<SharepointFolderLink | null> {
  const row = await loadProject(ctx, engagementId);
  if (!row.sharepointFolderId || !row.sharepointDriveId) return null;
  return { driveId: row.sharepointDriveId, folderId: row.sharepointFolderId, folderName: row.sharepointFolderName ?? '' };
}
