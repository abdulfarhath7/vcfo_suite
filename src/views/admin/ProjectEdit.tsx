'use client';

import { useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { CreateProjectForm } from '@/components/admin/CreateProjectForm';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { adminProjectPath, staffProjectBaseFromPathname } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { resolveEngagementFromRouteParam } from '@/lib/slug';

/** The create-project form pointed at an existing project — every field editable. */
export default function ProjectEdit() {
  const params = useParams();
  const slugParam = params.slug as string;
  const router = useRouter();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const projectBase = staffProjectBaseFromPathname(pathname, staffBase);
  const { engagements, engagementsLoading } = useApp();

  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, slugParam),
    [engagements, slugParam],
  );

  if (engagementsLoading && !eng) {
    return (
      <PageTransition>
        <HexgridLoader />
      </PageTransition>
    );
  }

  if (!eng) {
    return (
      <PageTransition>
        <p className="py-16 text-center text-sm text-muted-foreground">
          Project not found.
        </p>
      </PageTransition>
    );
  }

  const backToProject = () => router.push(adminProjectPath(eng, projectBase));

  return (
    <PageTransition>
      <SEO
        title={`Edit ${eng.companyName} — VCFO Suite`}
        description="Edit the details captured when this project was created."
        path={`${projectBase}/projects/${eng.slug ?? eng.id}/edit`}
      />

      <PageHeader accent="primary" icon={Pencil} title="Edit project" />

      <div className="mx-auto w-full max-w-3xl lg:max-w-none lg:pr-0">
        <CreateProjectForm
          editEngagement={eng}
          onCancel={backToProject}
          onSuccess={backToProject}
        />
      </div>
    </PageTransition>
  );
}
