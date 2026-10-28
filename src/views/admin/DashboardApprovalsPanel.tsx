'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { CompanyTile } from '@/components/staff/today/today-parts';
import { useApp } from '@/context/AppContext';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { pendingApprovalKind, usePendingApprovals } from '@/hooks/use-pending-approvals';
import { checklistItemLabel } from '@/lib/audit/audit-log';
import { adminProjectStepPath, staffProjectBaseFromPathname } from '@/lib/projects/project-step-path';

const MAX_ROWS = 6;

/**
 * Waiting for your approval (prototype ManagerToday "Approvals"): every step waiting on this
 * manager's (or the firm's) decision. Each row has the company tile, the step, the company and
 * the kind of request, and a strong navy button (D-13) that opens the step with its filled
 * fields and the Accept / Reject pair.
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
      title="Waiting for your approval"
      meta={String(rows.length)}
      href={`${projectBase}/approvals`}
      hrefLabel="All approvals"
      bodyClassName="p-0"
    >
      {shown.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-ink-muted">Nothing waiting</p>
      ) : (
        <ul>
          {shown.map((row) => {
            const href = adminProjectStepPath({ id: row.engagementId, slug: row.slug }, row.itemId, projectBase);
            return (
              <li
                key={`${row.engagementId}-${row.itemId}-${row.clientFill ? 'fill' : 'review'}`}
                className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0"
              >
                <CompanyTile name={row.companyName} size={30} />
                <span className="min-w-0 flex-1">
                  <Link href={href} className="block truncate font-medium leading-snug text-ink hover:underline">
                    {checklistItemLabel(row.itemId)}
                  </Link>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {row.companyName} · {pendingApprovalKind(row)}
                  </span>
                </span>
                <Button size="sm" variant="strong" asChild>
                  <Link href={href}>Review</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </DashSection>
  );
}
