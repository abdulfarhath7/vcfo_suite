import 'server-only';

import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances, complianceObligations, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  assertEngagementAccess,
  listScopedEngagementIds,
} from '@/db/repositories/engagements';
import { appEngagementId } from '@/lib/legacy-engagement-ids';
import {
  financialYearMonths,
  type FilingRow,
} from '@/lib/filings';

/**
 * FILINGS REPOSITORY — one scoped read over the existing compliance register.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * There is exactly one scope source: `listScopedEngagementIds(ctx)`, the same
 * predicate the rest of the app uses (admin/super firm-wide, manager owned,
 * lead assigned, client own engagements). Every query below is restricted to
 * that id list, so the SAME function serves all five roles and a client can
 * only ever read their own company — the per-role difference is the scope, not
 * the code path.
 *
 * Asking for one `engagementId` additionally runs `assertEngagementAccess`, so
 * a client cannot name someone else's engagement and have it honoured.
 *
 * This is a READ over the Inngest-generated `compliance_instances`. It creates
 * no second source of truth and writes nothing.
 *
 * >>> DATA DEPENDENCY (see FILINGS-BUILD-PROGRESS.md) <<<
 * TODO(owner): `compliance_obligations` has no dedicated `form` column. `particular` carries
 * the return/form name for most rows ("GSTR-3B", "Form 24Q") but not all
 * ("Advance Tax Payment Q1"), so it is surfaced under its own name and NOT
 * relabelled "Form". Nothing here fabricates a form code.
 */

export interface FilingsQuery {
  /** Restrict to one engagement. Access-checked; ignored if not permitted. */
  engagementId?: string;
  /** Indian FY start year (2026 = FY 2026-27). Omit for every period. */
  fyStartYear?: number;
}

export interface FilingsResult {
  rows: FilingRow[];
  /** Companies in scope — drives the firm-wide company selector. */
  companies: { engagementId: string; companyName: string }[];
}

/** Engagement ids this caller may read, honouring an explicit engagement ask. */
async function scopeIds(ctx: AuthContext, engagementId?: string): Promise<string[]> {
  const scoped = await listScopedEngagementIds(ctx);
  if (!engagementId?.trim()) return scoped;

  const access = await assertEngagementAccess(ctx, engagementId.trim());
  if (!access.ok) return [];
  // Belt and braces: the id must also be inside the role scope.
  return scoped.includes(access.dbId) ? [access.dbId] : [];
}

export async function getFilings(
  ctx: AuthContext,
  query: FilingsQuery = {},
): Promise<FilingsResult> {
  const ids = await scopeIds(ctx, query.engagementId);
  if (ids.length === 0) return { rows: [], companies: [] };

  const conditions = [inArray(complianceInstances.engagementId, ids)];
  if (query.fyStartYear !== undefined) {
    const months = financialYearMonths(query.fyStartYear);
    const first = months[0]!.key;
    const last = months[11]!.key;
    conditions.push(gte(complianceInstances.dueDate, `${first}-01`));
    // The 31st covers every month end; `date` comparison is lexicographic-safe.
    conditions.push(lte(complianceInstances.dueDate, `${last}-31`));
  }

  const rows = await db
    .select({
      id: complianceInstances.id,
      engagementId: complianceInstances.engagementId,
      dueDate: complianceInstances.dueDate,
      filedOn: complianceInstances.filedOn,
      periodLabel: complianceInstances.periodLabel,
      fyLabel: complianceInstances.fyLabel,
      status: complianceInstances.status,
      companyName: engagements.companyName,
      compliance: complianceObligations.complianceArea,
      particular: complianceObligations.particular,
      authority: complianceObligations.authority,
      frequency: complianceObligations.frequency,
    })
    .from(complianceInstances)
    .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
    .innerJoin(
      complianceObligations,
      eq(complianceObligations.id, complianceInstances.obligationId),
    )
    .where(and(...conditions))
    .orderBy(asc(complianceInstances.dueDate));

  const companies = new Map<string, string>();
  const out: FilingRow[] = rows.map((row) => {
    const appId = appEngagementId(row.engagementId);
    companies.set(appId, row.companyName);
    return {
      id: row.id,
      engagementId: appId,
      companyName: row.companyName,
      compliance: row.compliance,
      particular: row.particular,
      authority: row.authority,
      frequency: row.frequency,
      dueDate: row.dueDate,
      filedOn: row.filedOn ?? null,
      periodLabel: row.periodLabel ?? null,
      fyLabel: row.fyLabel ?? null,
      rawStatus: row.status,
    };
  });

  return {
    rows: out,
    companies: [...companies.entries()]
      .map(([engagementId, companyName]) => ({ engagementId, companyName }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName)),
  };
}
