import 'server-only';

/**
 * The few Microsoft Graph calls that read a SharePoint folder, as the signed-in person (delegated
 * Files.Read.All / Sites.Read.All). Read only: nothing here writes to SharePoint. The token comes
 * from `getGraphFileAccess` in the Outlook connection repository and never leaves the server.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface DriveItem {
  id: string;
  name: string;
  size: number;
  /** Set for a folder. */
  folder?: { childCount?: number };
  /** Set for a file. */
  file?: { mimeType?: string };
  /** Set for a OneNote notebook and similar packages, which are not plain files. */
  package?: { type?: string };
}

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

async function getJson<T>(access: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  if (!res.ok) throw new GraphError(`graph_${res.status}`, res.status);
  return (await res.json()) as T;
}

const encodePath = (path: string) => path.split('/').filter(Boolean).map(encodeURIComponent).join('/');

export interface SiteDrive {
  id: string;
  /** The library's display name, for example "Documents" or "Steadfast". */
  name: string;
  /** The library's address; its last part is the URL name, for example "Shared Documents". */
  webUrl?: string;
}

/** The site's document libraries and which one is the default. */
export async function graphSiteDrives(access: string, hostname: string, sitePath: string): Promise<{ defaultId: string; drives: SiteDrive[] }> {
  const siteUrl = sitePath ? `${GRAPH}/sites/${hostname}:/${encodePath(sitePath)}` : `${GRAPH}/sites/${hostname}`;
  const site = await getJson<{ id: string }>(access, `${siteUrl}?$select=id`);
  const base = `${GRAPH}/sites/${encodeURIComponent(site.id)}`;
  const [main, list] = await Promise.all([
    getJson<{ id: string }>(access, `${base}/drive?$select=id`),
    getJson<{ value: SiteDrive[] }>(access, `${base}/drives?$select=id,name,webUrl`),
  ]);
  return { defaultId: main.id, drives: list.value };
}

/** A folder or file by its path inside the drive. */
export async function graphItemByPath(access: string, driveId: string, path: string): Promise<DriveItem> {
  return getJson<DriveItem>(access, `${GRAPH}/drives/${encodeURIComponent(driveId)}/root:/${encodePath(path)}?$select=id,name,size,folder,file,package`);
}

/** One folder item, by id, to check it still exists and to read its name. */
export async function graphItem(access: string, driveId: string, itemId: string): Promise<DriveItem> {
  return getJson<DriveItem>(access, `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,size,folder,file,package`);
}

/** Every child of a folder, following Graph's pages. */
export async function graphListChildren(access: string, driveId: string, itemId: string): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let url: string | undefined = `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,size,folder,file,package&$top=200`;
  let pages = 0;
  while (url && pages < 50) {
    const page: { value: DriveItem[]; '@odata.nextLink'?: string } = await getJson(access, url);
    items.push(...page.value);
    const next: string | undefined = page['@odata.nextLink'];
    // Only follow a next page on Graph itself, so a token is never sent anywhere else.
    url = next && next.startsWith(`${GRAPH}/`) ? next : undefined;
    pages += 1;
  }
  return items;
}

/**
 * A file's bytes. Graph answers with a redirect to a short-lived download URL that needs no token;
 * fetch drops the Authorization header when the redirect leaves graph.microsoft.com.
 */
export async function graphDownload(access: string, driveId: string, itemId: string, maxBytes: number): Promise<Buffer> {
  const res = await fetch(`${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) throw new GraphError(`graph_download_${res.status}`, res.status);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > maxBytes) throw new GraphError('graph_download_too_large', 413);
  return bytes;
}
