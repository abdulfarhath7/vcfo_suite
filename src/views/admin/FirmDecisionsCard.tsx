'use client';

import Link from 'next/link';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { ProjectActionsMenu } from '@/components/admin/ProjectActionsMenu';
import { CompanyTile } from '@/components/staff/today/today-parts';
import type { Engagement } from '@/data/engagements';
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import { pendingApprovalKind, usePendingApprovals } from '@/hooks/use-pending-approvals';
import { checklistItemLabel } from '@/lib/audit/audit-log';
import { adminProjectStepPath } from '@/lib/projects/project-step-path';

const MAX_ROWS = 6;

/**
 * Needs your decision (prototype admin Today DecisionsCard): projects that have no manager yet,
 * with the project menu that assigns one, then every step waiting on a firm decision, each
 * opening the step with its Accept / Reject pair.
 */
export function FirmDecisionsCard({ engagements }: { engagements: Engagement[] }) {
  const approvals = usePendingApprovals('firm');
  const unassigned = engagements.filter((e) => e.stage !== 'Operational Readiness' && !e.managerId?.trim());
  const total = unassigned.length + approvals.length;
  const shownApprovals = approvals.slice(0, Math.max(0, MAX_ROWS - unassigned.length));

  return (
    <DashSection
      title="Needs your decision"
      meta={String(total)}
      href="/app/admin/approvals"
      hrefLabel="All approvals"
      bodyClassName="p-0"
    >
      {total === 0 ? (
        <p className="px-4 py-4 text-[13px] text-ink-muted">Nothing waiting</p>
      ) : (
        <ul>
          {unassigned.map((eng) => (
            <li key={eng.id} className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0">
              <CompanyTile name={eng.companyName} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{eng.companyName} has no manager</span>
                <span className="block truncate text-[12.5px] text-ink-muted">{stageDisplayLabel(eng.stage)}</span>
              </span>
              <ProjectActionsMenu engagement={eng} />
            </li>
          ))}
          {shownApprovals.map((row) => {
            const href = adminProjectStepPath({ id: row.engagementId, slug: row.slug }, row.itemId, '/app/admin');
            return (
              <li
                key={`${row.engagementId}-${row.itemId}-${row.clientFill ? 'fill' : 'review'}`}
                className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0"
              >
                <CompanyTile name={row.companyName} size={30} />
                <span className="min-w-0 flex-1">
                  <Link href={href} className="block truncate font-medium text-ink hover:underline">
                    {checklistItemLabel(row.itemId)}
                  </Link>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {row.companyName} · {pendingApprovalKind(row)}
                  </span>
                </span>
                <Button size="sm" variant="outline" asChild>
                  <Link href={href}>Decide</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </DashSection>
  );
}
