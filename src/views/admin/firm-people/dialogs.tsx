import { EmptyStateIllustrated } from '@/components/noir';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Briefcase, Check, FolderPlus, Loader2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABEL } from './types';
import type { FirmPeopleState } from './use-firm-people';

/** The Assign project and Change email dialogs, shared by both People views. */
export function createFirmPeopleDialogs(ctx: FirmPeopleState) {
  const {
    emailTarget,
    emailDraft,
    setEmailDraft,
    emailSaving,
    assignTarget,
    assignProjectId,
    setAssignProjectId,
    assigning,
    closeChangeEmail,
    onChangeEmail,
    portfolio,
    leadName,
    managerName,
    attachedToPerson,
    closeAssign,
    onAssignProject,
  } = ctx;

  const assignDialog = (
    <Dialog
      open={assignTarget !== null}
      onOpenChange={(open) => {
        if (!open) closeAssign();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign project</DialogTitle>
        </DialogHeader>
        {assignTarget ? (
          <>
            <p className="text-[12px] text-ink-muted">
              Attach a project to{' '}
              <span className="font-medium text-ink">{assignTarget.name}</span> (
              {ROLE_LABEL[assignTarget.role]}).{' '}
              {assignTarget.role === 'manager'
                ? 'They take over as project manager.'
                : 'They take over as delivery lead.'}
            </p>
            {portfolio.rows.length === 0 ? (
              <EmptyStateIllustrated
                icon={Briefcase}
                title="No active projects"
                className="py-8"
              />
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-line p-1">
                {portfolio.rows.map((c) => {
                  const attached = attachedToPerson(c, assignTarget);
                  const selected = assignProjectId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={attached}
                      onClick={() => setAssignProjectId(selected ? null : c.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors',
                        attached
                          ? 'cursor-default opacity-50'
                          : selected
                            ? 'bg-brand-soft ring-1 ring-brand/40'
                            : 'hover:bg-surface-sunken/40',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{c.company}</div>
                        <div className="truncate text-[11px] text-ink-muted">
                          Client {c.client} · PM {managerName(c.managerId)} · Lead{' '}
                          {leadName(c.leadId)} · {c.stage}
                        </div>
                      </div>
                      {attached ? (
                        <span className="mono shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">
                          Assigned
                        </span>
                      ) : selected ? (
                        <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAssign}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!assignProjectId || assigning}
                className="gap-2"
                onClick={() => void onAssignProject()}
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                Assign
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  const emailDialog = (
    <Dialog
      open={emailTarget !== null}
      onOpenChange={(open) => {
        if (!open) closeChangeEmail();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
        </DialogHeader>
        {emailTarget ? (
          <>
            <p className="text-[12px] text-ink-muted">
              Update the sign-in email for{' '}
              <span className="font-medium text-ink">{emailTarget.name}</span>. They will use
              this address next time they log in.
            </p>
            <div>
              <Label htmlFor="people-change-email" className="text-[12px] text-ink-muted">
                New email
              </Label>
              <Input
                id="people-change-email"
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="mt-1.5 h-10 font-mono text-[13px]"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeChangeEmail} disabled={emailSaving}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={emailSaving}
                className="gap-2"
                onClick={() => void onChangeEmail()}
              >
                {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Save email
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  return { assignDialog, emailDialog };
}

export type FirmPeopleDialogs = ReturnType<typeof createFirmPeopleDialogs>;
