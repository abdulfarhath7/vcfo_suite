'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { CreateProjectForm } from '@/components/admin/CreateProjectForm';
import { adminProjectPath, staffProjectBaseFromPathname } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';

export default function ProjectsNew() {
  const router = useRouter();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const projectBase = staffProjectBaseFromPathname(pathname, staffBase);

  return (
    <PageTransition>
      <SEO
        title="New project — VCFO Suite"
        description="Start a GCC setup project and provision the client portal account."
        path={`${projectBase}/projects/new`}
      />

      <PageHeader accent="primary" icon={Plus} title="New project" hideBack />

      <div className="mx-auto w-full max-w-3xl lg:max-w-none lg:pr-0">
        <CreateProjectForm
          onCancel={() => router.push(`${projectBase}/projects`)}
          onSuccess={(engagement) => router.push(adminProjectPath(engagement, projectBase))}
        />
      </div>
    </PageTransition>
  );
}
