import type { Incident, ServiceCheck, ServiceHealth } from './types';

/**
 * Uptime, p95 and incidents for the developer console, worked out from the stored live
 * checks (`dev_service_checks`). Pure, so the rules are tested without a database. The app
 * keeps no request metrics, so "uptime" here means the share of checks that passed, and
 * "p95" the 95th percentile of the check's own round trip.
 */

/** The 95th percentile (nearest rank) of a list of numbers, or null when it is empty. */
export function p95(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Health per service id. `checks` may hold any services, in any order. */
export function healthByService(serviceIds: string[], checks: ServiceCheck[]): ServiceHealth[] {
  return serviceIds.map((service) => {
    const mine = checks.filter((c) => c.service === service).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
    const passed = mine.filter((c) => c.ok).length;
    return {
      service,
      checks: mine.length,
      uptime: mine.length ? Math.round((passed / mine.length) * 1000) / 10 : null,
      p95: p95(mine.map((c) => c.latencyMs)),
      lastCheck: mine[0] ?? null,
    };
  });
}

/**
 * Incidents: for each service, a run of failed checks in time order makes one incident. It
 * ends at the first passing check after it, or stays open. Newest first.
 */
export function incidentsFrom(checks: ServiceCheck[]): Incident[] {
  const byService = new Map<string, ServiceCheck[]>();
  for (const c of checks) byService.set(c.service, [...(byService.get(c.service) ?? []), c]);

  const out: Incident[] = [];
  for (const [service, list] of byService) {
    const asc = [...list].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
    let open: Incident | null = null;
    for (const c of asc) {
      if (!c.ok) {
        if (open) open.failedChecks += 1;
        else open = { id: c.id, service, startedAt: c.checkedAt, endedAt: null, failedChecks: 1, detail: c.detail };
      } else if (open) {
        out.push({ ...open, endedAt: c.checkedAt });
        open = null;
      }
    }
    if (open) out.push(open);
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** "Uptime" tone: amber below 99.5 per cent (the prototype's rule). */
export function uptimeLow(uptime: number | null): boolean {
  return uptime !== null && uptime < 99.5;
}
