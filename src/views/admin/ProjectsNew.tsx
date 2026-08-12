'use client';

import { useRouter } from 'next/navigation';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { CreateProjectForm } from '@/components/admin/CreateProjectForm';
import { adminProjectPath } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';

export default function ProjectsNew() {
  const router = useRouter();
  const staffBase = useStaffBasePath();

  return (
    <PageTransition>
      <SEO
        title="New project — VCFO Suite"
        description="Start a GCC setup project and provision the client portal account."
        path={`${staffBase}/projects/new`}
      />

      <div className="mx-auto w-full max-w-3xl lg:max-w-none lg:pr-0">
        <CreateProjectForm
          onCancel={() => router.push(`${staffBase}/projects`)}
          onSuccess={(engagement) => router.push(adminProjectPath(engagement, staffBase))}
        />
      </div>
    </PageTransition>
  );
}
