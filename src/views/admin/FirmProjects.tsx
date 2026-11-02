'use client';

import { Suspense, useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { ActionMenu } from '@/components/ui/action-menu';
import { exportRowsCsv } from '@/components/staff/today/work-actions';
import { AssignClientDialog, type ManagerOption } from '@/views/admin/managers/managers-dialogs';
import { useFirmWorkRows } from '@/views/admin/work/use-firm-work-rows';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { FirmProjectsPanel } from '@/views/admin/FirmProjectsPanel';
import { LeadsWorkPanel, ManagersWorkPanel } from '@/views/admin/work/FirmWorkPanels';

type WorkTab = 'projects' | 'managers' | 'leads';

/**
 * Admin Work (prototype WorkScreen for the admin, G-18). Projects is the firm-wide project
 * list kept for deep links (the primary list lives on Home). Managers is the feed of items on
 * each manager's engagements with the Status, By area and Open by manager cards; Project leads
 * is the full Work screen over every lead's items (list, board, timeline and planner, with
 * bulk Assign and row Reassign). The tab lives in `?tab=`, so the Work filters keep it. The
 * head shows "N open · N companies", "Assign client" and a menu with Export.
 */

const TABS = new Set<WorkTab>(['projects', 'managers', 'leads']);

async function fetchManagers(): Promise<ManagerOption[]> {
  const res = await fetch('/api/admin/managers');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body.managers ?? []) as ManagerOption[];
}
export default function FirmProjects() {
  // The Projects list reads `?view=` (a home card tile's saved view), so the page sits under Suspense.
  return (
    <Suspense fallback={null}>
      <FirmProjectsInner />
    </Suspense>
  );
}

function FirmProjectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const viewParam = params.get('view');
  const tabParam = params.get('tab') as WorkTab | null;
  const [tab, setTab] = useState<WorkTab>(tabParam && TABS.has(tabParam) ? tabParam : 'projects');
  useEffect(() => {
    // A home card tile opens the Projects list on a saved view; the other tabs keep `?tab=`.
    if (viewParam && !tabParam) setTab('projects');
  }, [viewParam, tabParam]);
  const chooseTab = (next: WorkTab) => {
    setTab(next);
    router.replace(next === 'projects' ? '/app/admin/projects' : `/app/admin/projects?tab=${next}`, { scroll: false });
  };
  const { engagements, updateEngagement } = useApp();
  const { rows } = useFirmWorkRows();
  const managersQuery = useQuery({ queryKey: ['admin-managers'], queryFn: fetchManagers, staleTime: 5 * 60_000 });
  const [assignOpen, setAssignOpen] = useState(false);
  const open = rows.filter((r) => r.status !== 'Done');
  const companies = new Set(open.map((r) => r.engagementId)).size;
  return (
    <PageTransition>
      <SEO title="Work — VCFO Suite" description="Firm-wide projects and work items." path="/app/admin/projects" />
      <PageHeader
        accent="primary"
        icon={Briefcase}
        title="Work"
        subtitle={`${open.length} open · ${companies} ${companies === 1 ? 'company' : 'companies'}`}
        actions={
          <>
            <SpectrumTabs
              label="Work"
              items={[
                { key: 'projects', label: 'Projects' },
                { key: 'managers', label: 'Managers' },
                { key: 'leads', label: 'Project leads' },
              ]}
              value={tab}
              onChange={(k) => chooseTab(k as WorkTab)}
            />
            <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>
              Assign client
            </Button>
            <Button size="sm" onClick={() => router.push('/app/admin/projects/new')}>
              New project
            </Button>
            <ActionMenu
              label="More actions"
              trigger={
                <Button size="icon" variant="secondary" aria-label="More actions" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
                </Button>
              }
              items={[
                {
                  label: 'Export',
                  onSelect: () =>
                    exportRowsCsv(
                      'work.csv',
                      ['Item', 'Client', 'Manager', 'Lead', 'Area', 'Status', 'Due'],
                      rows.map((r) => [r.title, r.companyName, r.managerName, r.leadName, r.area, r.status, r.dueAt?.slice(0, 10) ?? '']),
                    ),
                },
              ]}
            />
          </>
        }
      />
      {tab === 'projects' ? <FirmProjectsPanel compact viewParam={viewParam} /> : null}
      {tab === 'managers' ? <ManagersWorkPanel /> : null}
      {tab === 'leads' ? <LeadsWorkPanel /> : null}
      <AssignClientDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        engagements={engagements}
        managers={managersQuery.data ?? []}
        onSave={(engagementId, managerId) => updateEngagement(engagementId, { managerId })}
      />
    </PageTransition>
  );
}
