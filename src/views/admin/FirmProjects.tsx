'use client';

import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { FirmProjectsPanel } from '@/views/admin/FirmProjectsPanel';

/** Standalone projects page kept for deep links; primary list lives on Home. */
export default function FirmProjects() {
  const router = useRouter();
  return (
    <PageTransition>
      <SEO title="Projects — VCFO Suite" description="Firm-wide GCC projects." path="/app/admin/projects" />
      <PageHeader
        accent="primary"
        icon={Briefcase}
        title="Projects"
        actions={
          <Button size="sm" onClick={() => router.push('/app/admin/projects/new')}>
            New project
          </Button>
        }
      />
      <FirmProjectsPanel compact />
    </PageTransition>
  );
}
