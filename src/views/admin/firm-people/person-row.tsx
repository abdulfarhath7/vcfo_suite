import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Briefcase, FolderPlus, KeyRound, Loader2, Mail, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminProjectPath } from '@/lib/projects/project-step-path';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './parts';
import type { StaffRow } from './types';
import type { FirmPeopleState } from './use-firm-people';

/** Select value for "reports to no admin" (Radix Select items cannot be empty). */
const NO_ADMIN = '__none';

/**
 * One person in a list, with their attached projects and the actions menu.
 * Built per render inside the page (as before the split), so it closes over
 * the page's current state. A project manager row also carries the "Reports to
 * admin" picker for firm-wide admins (G-20), which saves on change.
 */
export function createPersonRow(ctx: FirmPeopleState) {
  const {
    user,
    staffBase,
    deletingId,
    onDelete,
    setResetTarget,
    openChangeEmail,
    projectsForPerson,
    openAssign,
    isAdmin,
    admins,
    reportingQuery,
    reportingSaving,
    adminIdOfManager,
    setManagerAdmin,
  } = ctx;

  function PersonRow({
    person,
    meta,
    canManage,
    canAssign,
    onOpen,
  }: {
    person: StaffRow;
    meta?: string;
    canManage: boolean;
    canAssign?: boolean;
    onOpen?: () => void;
  }) {
    const attachedProjects = canAssign ? projectsForPerson(person) : [];
    const showMenu = canManage && person.id !== user?.id;
    // Firm admins and the super admin reset a staff member's two-step sign-in, only when it is on.
    const canResetTwoStep = isAdmin && person.role !== 'client' && Boolean(person.twoStepOn);
    return (
      <div className="border-b border-line-soft px-4 py-2.5 last:border-b-0">
        <div className="flex min-h-[30px] items-center justify-between gap-3">
          {onOpen ? (
            <button
              type="button"
              className="-mx-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-0.5 text-left hover:bg-surface-sunken/60"
              onClick={onOpen}
            >
              <PersonAvatar name={person.name} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-ink">{person.name}</span>
                <span className="block truncate text-[12.5px] text-ink-muted">
                  {person.email}
                  {meta ? ` · ${meta}` : ''}
                </span>
              </span>
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <PersonAvatar name={person.name} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-ink">{person.name}</span>
                <span className="block truncate text-[12.5px] text-ink-muted">
                  {person.email}
                  {meta ? ` · ${meta}` : ''}
                </span>
              </span>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {isAdmin && person.role === 'manager' && !reportingQuery.isPending ? (
              <Select
                value={adminIdOfManager(person.id) ?? NO_ADMIN}
                disabled={reportingSaving === person.id}
                onValueChange={(v) => void setManagerAdmin(person, v === NO_ADMIN ? null : v)}
              >
                <SelectTrigger className="h-control-sm w-44 text-[13px]" aria-label={`${person.name} reports to admin`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ADMIN}>No admin</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      Reports to {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {canAssign ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openAssign(person)}
              >
                <FolderPlus className="h-4 w-4" strokeWidth={1.6} />
                Assign project
              </Button>
            ) : null}
            {showMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    className="w-control-sm min-w-0 px-0"
                    aria-label={`Actions for ${person.name}`}
                    disabled={deletingId === person.id}
                  >
                    {deletingId === person.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => openChangeEmail(person)}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Change email
                  </DropdownMenuItem>
                  {canResetTwoStep ? (
                    <DropdownMenuItem className="gap-2" onSelect={() => setResetTarget(person)}>
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset two-step sign-in
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-danger focus:text-danger"
                    onSelect={() => onDelete(person)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete person
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        {attachedProjects.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-10">
            {attachedProjects.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={adminProjectPath({ id: p.id, slug: p.slug }, staffBase)}
                className={cn(
                  'inline-flex h-6 max-w-48 items-center gap-1.5 rounded-md border-1.5 bg-surface-raised px-2 text-[12px] font-medium text-ink-2 transition-colors hover:bg-surface-sunken',
                  p.stuck ? 'border-warning-mid' : 'border-line',
                )}
              >
                <Briefcase className="h-3 w-3 shrink-0 text-ink-muted" strokeWidth={1.6} aria-hidden />
                <span className="truncate">{p.company}</span>
              </Link>
            ))}
            {attachedProjects.length > 4 ? (
              <span className="text-[12px] text-ink-muted">
                +{attachedProjects.length - 4} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return PersonRow;
}
