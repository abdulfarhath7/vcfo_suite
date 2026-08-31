'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Surface, Eyebrow, EmptyStateIllustrated } from '@/components/noir';
import { ClipboardCheck } from 'lucide-react';
import { isAwaitingReview } from '@/lib/checklist-item-review';
import { isClientFillPending } from '@/lib/checklist-client-fill';
import { primaryPhaseItems } from '@/lib/project-stuck';
import { checklistItemLabel } from '@/lib/audit-log';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { adminProjectStepPath } from '@/lib/project-step-path';
import { ProjectChangeRequestsPanel } from '@/views/admin/ProjectChangeRequestsPanel';

export default function ApprovalsInbox({ scope }: { scope: 'firm' | 'manager' }) {
  const { engagements, getStateForEngagement, user } = useApp();
  const router = useRouter();
  const staffBase = useStaffBasePath();

  const rows = useMemo(() => {
    const out: {
      engagementId: string;
      companyName: string;
      itemId: string;
      slug?: string;
      reviewSource?: string;
      /** Lead is asking to send this step to the client — approve before it goes out. */
      clientFill?: { requestedByName?: string; note?: string };
    }[] = [];
    for (const eng of engagements) {
      if (eng.stage === 'Operational Readiness') continue;
      if (scope === 'manager' && user?.role === 'manager' && eng.managerId && eng.managerId !== user.id) {
        continue;
      }
      const state = getStateForEngagement(eng);
      for (const item of primaryPhaseItems()) {
        const slice = state[item.id];
        if (isAwaitingReview(slice)) {
          out.push({
            engagementId: eng.id,
            companyName: eng.companyName,
            itemId: item.id,
            slug: eng.slug,
            reviewSource: slice?.reviewSource,
          });
        }
        if (isClientFillPending(slice?.clientFillRequest)) {
          out.push({
            engagementId: eng.id,
            companyName: eng.companyName,
            itemId: item.id,
            slug: eng.slug,
            clientFill: {
              requestedByName: slice?.clientFillRequest?.requestedByName,
              note: slice?.clientFillRequest?.note,
            },
          });
        }
      }
    }
    return out;
  }, [engagements, getStateForEngagement, scope, user]);

  const path = scope === 'firm' ? '/app/admin/approvals' : `${staffBase}/approvals`;

  return (
    <PageTransition>
      <SEO
        title="Approvals — VCFO Suite"
        description="Pending milestone reviews."
        path={path}
      />
      <PageHeader
        accent="amber"
        icon={ClipboardCheck}
        title="Approvals"
      />

      <ProjectChangeRequestsPanel scope={scope} />

      <Surface className="divide-y divide-border">
        <div className="px-4 py-3">
          <Eyebrow>Pending milestones</Eyebrow>
        </div>
        {rows.length === 0 ? (
          <EmptyStateIllustrated
            icon={ClipboardCheck}
            title="Nothing waiting for approval"
            actionLabel="View projects"
            onAction={() => router.push(scope === 'firm' ? '/app/admin/projects' : `${staffBase}/projects`)}
            className="rounded-none border-0 bg-transparent"
          />
        ) : (
          rows.map((row) => (
            <div
              key={`${row.engagementId}-${row.itemId}-${row.clientFill ? 'fill' : 'review'}`}
              className="p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">{row.companyName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {checklistItemLabel(row.itemId)}
                  {row.clientFill
                    ? ` · Send to client${
                        row.clientFill.requestedByName ? ` · ${row.clientFill.requestedByName}` : ''
                      }`
                    : row.reviewSource === 'lead_manager_request'
                      ? ' · Lead request'
                      : ' · Client submit'}
                </div>
                {row.clientFill?.note ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">{row.clientFill.note}</div>
                ) : null}
              </div>
              <button
                type="button"
                className="text-[12px] text-brand shrink-0"
                onClick={() =>
                  router.push(adminProjectStepPath({ id: row.engagementId, slug: row.slug }, row.itemId, staffBase))
                }
              >
                Open
              </button>
            </div>
          ))
        )}
      </Surface>
    </PageTransition>
  );
}
