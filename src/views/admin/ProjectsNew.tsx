"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, FolderPlus } from "lucide-react";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { SEO } from "@/components/SEO";
import { Surface } from "@/components/noir";
import { CreateProjectForm } from "@/components/admin/CreateProjectForm";
import { adminProjectPath } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';

export default function ProjectsNew() {
  const router = useRouter();
  const staffBase = useStaffBasePath();

  return (
    <PageTransition>
      <SEO
        title="New GCC Setup Project — VCFO Suite"
        description="Start a GCC setup project and provision the client portal account."
        path={`${staffBase}/projects/new`}
      />

      <Link
        href={`${staffBase}/projects`}
        className="text-[11px] mono uppercase tracking-[0.18em] text-paper-muted hover:text-orange-600 flex items-center gap-1 mb-4 transition-colors w-fit"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> GCC setup projects
      </Link>

      <PageHeader
        accent="primary"
        icon={FolderPlus}
        title="Start a GCC setup project"
        subtitle="Creates the project in VCFO Suite, provisions the client portal, seeds setup-phase tasks, and sends a welcome email when Resend is configured."
      />

      <Surface className="max-w-2xl p-5 sm:p-6">
        <CreateProjectForm
          onCancel={() => router.push(`${staffBase}/projects`)}
          onSuccess={(engagement) => router.push(adminProjectPath(engagement, staffBase))}
        />
      </Surface>
    </PageTransition>
  );
}
