'use client';

import { sep } from '@/lib/date-format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { StageChip, PeopleCard } from '@/views/admin/firm-people/parts';
import { RecordTile } from '@/components/incorporation/RecordHead';
import { Button } from '@/components/ui/button';
import { listDeletedProjects, restoreProjectInDb } from '@/lib/projects/project-admin-db';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

function deletedLabel(iso: string | null): string {
  if (!iso) return 'Deleted';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Deleted';
  return `Deleted ${sep(d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }))}`;
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

      <PeopleCard title="Deleted projects" count={deletedQuery.isLoading ? undefined : projects.length}>
        {deletedQuery.isLoading ? (
          <SkeletonRows className="p-4" />
        ) : projects.length === 0 ? (
          <EmptyState
            title="Nothing deleted"
            className="m-4"
            action={
              <Button size="sm" variant="secondary" onClick={() => router.push(`${staffBase}/projects`)}>
                View projects
              </Button>
            }
          />
        ) : (
          projects.map((project) => {
            const busy = restore.isPending && restore.variables === project.id;
            return (
              <div
                key={project.id}
                className="flex min-h-11 flex-wrap items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0"
              >
                <RecordTile name={project.companyName} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{project.companyName}</div>
                  <div className="text-[12.5px] text-ink-muted">{deletedLabel(project.deletedAt)}</div>
                </div>
                <StageChip stage={project.stage} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => restore.mutate(project.id)}
                >
                  {busy ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw strokeWidth={1.6} aria-hidden />
                  )}
                  Restore
                </Button>
              </div>
            );
          })
        )}
      </PeopleCard>
    </PageTransition>
  );
}
