import Link from 'next/link';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Surface, Eyebrow, EmptyStateIllustrated } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { Briefcase, FolderPlus, Loader2, Mail, MoreHorizontal, Trash2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { adminProjectPath } from '@/lib/projects/project-step-path';
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
                  variant="outline"
                  className="gap-1.5"
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

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Projects', value: managerProjects.length },
          { label: 'Leads', value: managerLeads.length },
          {
            label: 'Need attention',
            value: managerProjects.filter((p) => p.stuck).length,
          },
        ].map((c) => (
          <Surface key={c.label} className="p-4">
            <Eyebrow>{c.label}</Eyebrow>
            <div className="mt-2 text-2xl font-serif tabular-nums">{c.value}</div>
          </Surface>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="divide-y divide-line">
          <div className="px-4 py-3">
            <Eyebrow>Project leads</Eyebrow>
          </div>
          {managerLeads.length === 0 ? (
            <EmptyStateIllustrated
              icon={Users}
              title="No leads yet"
              className="m-4 py-8"
            />
          ) : (
            managerLeads.map((l) => (
              <PersonRow
                key={l.id}
                person={l}
                canManage
              />
            ))
          )}
        </Surface>

        <Surface className="divide-y divide-line">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <Eyebrow>Clients & projects</Eyebrow>
            {selectedManager ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={() => openAssign(selectedManager)}
              >
                <FolderPlus className="h-3 w-3" />
                Assign project
              </Button>
            ) : null}
          </div>
          {managerProjects.length === 0 ? (
            <EmptyStateIllustrated
              icon={Briefcase}
              title="No projects assigned"
              className="m-4 py-8"
            />
          ) : (
            managerProjects.map((c) => (
              <Link
                key={c.id}
                href={adminProjectPath({ id: c.id, slug: c.slug }, staffBase)}
                className="block px-4 py-3 hover:bg-surface-sunken/40"
              >
                <div className="truncate text-[13px] font-medium">{c.company}</div>
                <div className="text-[11px] text-ink-muted">
                  Client {c.client} · Lead {leadName(c.leadId)} · {c.stage}
                  {c.stuck ? ' · needs attention' : ''}
                </div>
              </Link>
            ))
          )}
        </Surface>
      </div>
      {assignDialog}
      {emailDialog}
    </PageTransition>
  );
}
