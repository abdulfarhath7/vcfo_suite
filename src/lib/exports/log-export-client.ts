/**
 * Browser side of the export log (P-373): after a CSV the page built itself is downloaded,
 * send it to `/api/exports/log` so it is listed on the developer console and kept 30 days.
 * Fire and forget: a failure never touches the download.
 */
export function logBrowserExport(kind: 'audit_log', fileName: string, csv: string): void {
  void fetch('/api/exports/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, fileName, csv }),
    keepalive: csv.length < 60000,
  }).catch(() => undefined);
}
