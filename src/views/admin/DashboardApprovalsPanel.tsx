'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { useApp } from '@/context/AppContext';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { pendingApprovalKind, usePendingApprovals } from '@/hooks/use-pending-approvals';
import { checklistItemLabel } from '@/lib/audit-log';
import { adminProjectStepPath, staffProjectBaseFromPathname } from '@/lib/project-step-path';

const MAX_ROWS = 6;

/**
 * Dashboard: every step waiting on this manager's (or the firm's) decision,
 * each row opening the step with its filled fields and the Accept / Reject pair.
 */
export function DashboardApprovalsPanel() {
  const { user } = useApp();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const projectBase = staffProjectBaseFromPathname(pathname, staffBase);
  const scope = user?.role === 'manager' ? 'manager' : 'firm';
  const rows = usePendingApprovals(scope);
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <DashSection
      icon={ClipboardCheck}
      tone="warning"
      title="Approvals"
      meta={rows.length > 0 ? `${rows.length} waiting` : 'Nothing waiting'}
      href={`${projectBase}/approvals`}
      hrefLabel="All approvals"
    >
      {shown.length === 0 ? (
        <p className="py-2 text-[12px] text-muted-foreground">
          Requests from your leads and client submissions land here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((row) => (
            <li key={`${row.engagementId}-${row.itemId}-${row.clientFill ? 'fill' : 'review'}`}>
              <Link
                href={adminProjectStepPath({ id: row.engagementId, slug: row.slug }, row.itemId, projectBase)}
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink transition-colors group-hover:text-primary">
                    {row.companyName}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {checklistItemLabel(row.itemId)} · {pendingApprovalKind(row)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-extrabold text-primary">
                  Review
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}
