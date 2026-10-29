'use client';

import { Suspense, useEffect, useState } from 'react';
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
 * each manager's engagements; Project leads lists every lead's items with Reassign.
 */
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
  const [tab, setTab] = useState<WorkTab>('projects');
  useEffect(() => {
    if (viewParam) setTab('projects');
  }, [viewParam]);
  return (
    <PageTransition>
      <SEO title="Work — VCFO Suite" description="Firm-wide projects and work items." path="/app/admin/projects" />
      <PageHeader
        accent="primary"
        icon={Briefcase}
        title="Work"
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
              onChange={(k) => setTab(k as WorkTab)}
            />
            <Button size="sm" onClick={() => router.push('/app/admin/projects/new')}>
              New project
            </Button>
          </>
        }
      />
      {tab === 'projects' ? <FirmProjectsPanel compact viewParam={viewParam} /> : null}
      {tab === 'managers' ? <ManagersWorkPanel /> : null}
      {tab === 'leads' ? <LeadsWorkPanel /> : null}
    </PageTransition>
  );
}
