import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { EmptyState } from '@/components/ui/empty-state';
import { RecordStat, RecordStats } from '@/components/incorporation/RecordHead';
import { PeopleCard, PeopleProjectsGrid } from './parts';
import { Button } from '@/components/ui/button';
import { FolderPlus, Loader2, Mail, MoreHorizontal, Trash2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ReactNode } from 'react';
import type { FirmPeopleState } from './use-firm-people';
import type { FirmPeopleDialogs } from './dialogs';
import type { createPersonRow } from './person-row';

type PersonRowComponent = ReturnType<typeof createPersonRow>;

/** Admin drill-down into one project manager: their leads, projects and actions. */
export function renderManagerView(
  ctx: FirmPeopleState & FirmPeopleDialogs & { PersonRow: PersonRowComponent },
): ReactNode {
  const {
    user,
    staffBase,
    deletingId,
    onDelete,
    openChangeEmail,
    leadName,
    openAssign,
    selectedManager,
    managerLeads,
    managerProjects,
    PersonRow,
    assignDialog,
    emailDialog,
  } = ctx;
  const mgrName = selectedManager?.name ?? 'Project manager';
  const mgrEmail =
    selectedManager && 'email' in selectedManager ? selectedManager.email : '';
  return (
    <PageTransition>
      <SEO
        title={`${mgrName} — People`}
        description="Manager-wise leads, clients, and projects."
        path={`${staffBase}/people`}
      />
      <PageHeader
        accent="violet"
        icon={Users}
        title={mgrName}
        subtitle={mgrEmail || undefined}
        forceBack
        backFallbackHref={`${staffBase}/people`}
        actions={
          selectedManager && selectedManager.id !== user?.id ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={deletingId === selectedManager.id}
                  aria-label="Manager actions"
                >
                  {deletingId === selectedManager.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  )}
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() =>
                    openChangeEmail({
                      id: selectedManager.id,
                      name: mgrName,
                      email: mgrEmail,
                      role: 'manager',
                    })
                  }
                >
                  <Mail className="h-3.5 w-3.5" />
                  Change email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-danger focus:text-danger"
                  onSelect={() =>
                    void onDelete({
                      id: selectedManager.id,
                      name: mgrName,
                      email: mgrEmail,
                      role: 'manager',
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete person
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      <div className="mb-5">
        <RecordStats>
          <RecordStat value={managerProjects.length} label="projects" />
          <RecordStat value={managerLeads.length} label="leads" />
          <RecordStat value={managerProjects.filter((p) => p.stuck).length} label="need attention" />
        </RecordStats>
      </div>

      <div className="grid gap-4">
        <PeopleCard title="Project leads" count={managerLeads.length}>
          {managerLeads.length === 0 ? (
            <EmptyState title="No leads yet" className="m-4" />
          ) : (
            managerLeads.map((l) => (
              <PersonRow
                key={l.id}
                person={l}
                canManage
              />
            ))
          )}
        </PeopleCard>

        <PeopleCard
          title="Clients & projects"
          count={managerProjects.length}
          action={
            selectedManager ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => openAssign(selectedManager)}>
                <FolderPlus className="h-4 w-4" strokeWidth={1.6} />
                Assign project
              </Button>
            ) : null
          }
        >
          {managerProjects.length === 0 ? (
            <EmptyState title="No projects assigned" className="m-4" />
          ) : (
            <PeopleProjectsGrid rows={managerProjects} staffBase={staffBase} leadName={leadName} showManager={false} />
          )}
        </PeopleCard>
      </div>
      {assignDialog}
      {emailDialog}
    </PageTransition>
  );
}
