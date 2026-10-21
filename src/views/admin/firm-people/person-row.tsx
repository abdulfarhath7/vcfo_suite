import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Briefcase, FolderPlus, Loader2, Mail, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { adminProjectPath } from '@/lib/projects/project-step-path';
import { cn } from '@/lib/utils';
import type { StaffRow } from './types';
import type { FirmPeopleState } from './use-firm-people';

/**
 * One person in a list, with their attached projects and the actions menu.
 * Built per render inside the page (as before the split), so it closes over
 * the page's current state.
 */
export function createPersonRow(ctx: FirmPeopleState) {
  const {
    user,
    staffBase,
    deletingId,
    onDelete,
    openChangeEmail,
    projectsForPerson,
    openAssign,
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
    return (
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          {onOpen ? (
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md -mx-1 px-1 py-0.5 text-left hover:bg-surface-sunken/40"
              onClick={onOpen}
            >
              <div className="text-[13px] font-medium">{person.name}</div>
              <div className="font-mono text-[11px] text-ink-muted">{person.email}</div>
              {meta ? <div className="mt-1 text-[11px] text-ink-muted">{meta}</div> : null}
            </button>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{person.name}</div>
              <div className="font-mono text-[11px] text-ink-muted">{person.email}</div>
              {meta ? <div className="mt-1 text-[11px] text-ink-muted">{meta}</div> : null}
            </div>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {canAssign ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => openAssign(person)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Assign project
              </Button>
            ) : null}
            {showMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-danger focus:text-danger"
                    onSelect={() => void onDelete(person)}
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
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {attachedProjects.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={adminProjectPath({ id: p.id, slug: p.slug }, staffBase)}
                className={cn(
                  'inline-flex max-w-48 items-center gap-1 rounded-sm border border-line bg-surface px-2 py-0.5 text-[10.5px] transition-colors hover:border-brand/40 hover:text-ink',
                  p.stuck ? 'text-warning' : 'text-ink-muted',
                )}
              >
                <Briefcase className="h-2.5 w-2.5 shrink-0" aria-hidden />
                <span className="truncate">{p.company}</span>
              </Link>
            ))}
            {attachedProjects.length > 4 ? (
              <span className="text-[10.5px] text-ink-muted">
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
