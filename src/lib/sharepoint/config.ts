/**
 * Where the firm keeps its client folders in SharePoint. Both values come from the environment, so
 * local, staging and production can point at different sites (golden rule 4).
 *
 *   SHAREPOINT_SITE_URL      the site, for example https://sbcllp.sharepoint.com/sites/Work
 *   SHAREPOINT_CLIENTS_PATH  the folder that holds one folder per client, inside the site's
 *                            default document library; "/Clients" when not set
 */
export interface SharepointConfig {
  hostname: string;
  /** The site's server-relative path, for example `/sites/Work`, or empty for the root site. */
  sitePath: string;
  /** The clients folder inside the document library, without leading or trailing slashes. */
  clientsPath: string;
}

export function sharepointConfig(env: Record<string, string | undefined> = process.env): SharepointConfig | null {
  const raw = env.SHAREPOINT_SITE_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.sharepoint.com')) return null;
  const sitePath = url.pathname.replace(/\/+$/, '');
  const clientsPath = (env.SHAREPOINT_CLIENTS_PATH?.trim() || '/Clients').replace(/^\/+|\/+$/g, '');
  if (!clientsPath || clientsPath.split('/').some((p) => p === '..')) return null;
  return { hostname: url.hostname, sitePath, clientsPath };
}
