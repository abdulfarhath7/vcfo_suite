import type { SiteDrive } from './graph';

/**
 * Where the clients folder may be, in the order to try. SHAREPOINT_CLIENTS_PATH may name the
 * library first, as the SharePoint breadcrumb shows it ("SteadFast/Clients"), or by its URL name
 * ("Shared Documents/Clients"). The same words can also be a folder in the default library, so both
 * readings are returned: the named library first, then the default library with the whole path.
 */
export function libraryCandidates(clientsPath: string, site: { defaultId: string; drives: readonly SiteDrive[] }): Array<{ driveId: string; path: string }> {
  const parts = clientsPath.split('/').filter(Boolean);
  const first = parts[0]?.toLowerCase();
  const out: Array<{ driveId: string; path: string }> = [];
  if (first && parts.length > 1) {
    const urlName = (d: SiteDrive) => decodeURIComponent(d.webUrl?.split('/').filter(Boolean).pop() ?? '').toLowerCase();
    for (const d of site.drives) if (d.name.toLowerCase() === first || urlName(d) === first) out.push({ driveId: d.id, path: parts.slice(1).join('/') });
  }
  out.push({ driveId: site.defaultId, path: parts.join('/') });
  return out;
}
