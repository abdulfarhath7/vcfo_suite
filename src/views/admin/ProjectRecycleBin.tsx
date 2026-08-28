'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { Surface, Eyebrow, EmptyStateIllustrated } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { listDeletedProjects, restoreProjectInDb } from '@/lib/project-admin-db';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

function deletedLabel(iso: string | null): string {
  if (!iso) return 'Deleted';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Deleted';
  return `Deleted ${d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

/**
 * Soft-deleted projects. Nothing was destroyed — restoring clears `deleted_at`
 * and the project returns to every list with its documents, checklist state,
 * and audit trail intact.
 */
export default function ProjectRecycleBin() {
  const router = useRouter();
  const staffBase = useStaffBasePath();
  const queryClient = useQueryClient();

  const deletedQuery = useQuery({
    queryKey: ['admin-deleted-projects'],
    queryFn: listDeletedProjects,
    staleTime: 15_000,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreProjectInDb(id),
    onSuccess: (engagement) => {
      toastSuccess('Project restored', engagement?.companyName ?? 'It is back in the list.');
      void queryClient.invalidateQueries({ queryKey: ['admin-deleted-projects'] });
      void queryClient.invalidateQueries({ queryKey: ['engagements'] });
    },
    onError: (err) => {
      toastError("Couldn't restore the project", errorMessage(err, 'Try again in a moment.'));
    },
  });

  const projects = deletedQuery.data ?? [];

  return (
    <PageTransition>
      <SEO
        title="Deleted projects — VCFO Suite"
        description="Restore a project that was deleted."
        path={`${staffBase}/projects/recycle-bin`}
      />
      <PageBackCluster>
        <PageHeader
          accent="rose"
          icon={Trash2}
          title="Deleted projects"
        />
      </PageBackCluster>

      {deletedQuery.isLoading ? (
        <HexgridLoader />
      ) : (
        <Surface className="divide-y divide-border">
          <div className="px-4 py-3">
            <Eyebrow>In the bin · {projects.length}</Eyebrow>
          </div>
          {projects.length === 0 ? (
            <EmptyStateIllustrated
              icon={Trash2}
              title="Nothing deleted"
              actionLabel="View projects"
              onAction={() => router.push(`${staffBase}/projects`)}
              className="rounded-none border-0 bg-transparent"
            />
          ) : (
            projects.map((project) => {
              const busy = restore.isPending && restore.variables === project.id;
              return (
                <div
                  key={project.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-ink">
                      {project.companyName}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {project.stage} · {deletedLabel(project.deletedAt)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => restore.mutate(project.id)}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Restore
                  </Button>
                </div>
              );
            })
          )}
        </Surface>
      )}
    </PageTransition>
  );
}
