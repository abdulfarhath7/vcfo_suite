'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Engagement } from '@/data/engagements';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

export type ManagerOption = { id: string; name: string; email: string };

/**
 * Assign client (prototype `AssignDialog` mode "client"): put one client under a manager.
 * With `managerId` the manager is fixed and the admin picks the client; with `engagementId`
 * the client is fixed (an escalation's Reassign, a row of the Assign card) and the admin picks
 * the manager. Saves `engagements.manager_id` through `updateEngagement`.
 */
export function AssignClientDialog({
  open,
  onOpenChange,
  engagements,
  managers,
  managerId,
  engagementId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagements: Engagement[];
  managers: ManagerOption[];
  managerId?: string | null;
  engagementId?: string | null;
  onSave: (engagementId: string, managerId: string) => Promise<unknown>;
}) {
  const [client, setClient] = useState('');
  const [manager, setManager] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClient(engagementId ?? '');
    setManager(managerId ?? '');
  }, [open, engagementId, managerId]);

  const clients = useMemo(
    () =>
      engagements
        .filter((e) => e.stage !== 'Operational Readiness' && (!managerId || e.managerId !== managerId))
        .sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [engagements, managerId],
  );
  const fixedClient = engagementId ? engagements.find((e) => e.id === engagementId) : undefined;
  const fixedManager = managerId ? managers.find((m) => m.id === managerId) : undefined;

  async function submit() {
    if (!client || !manager) return;
    setSaving(true);
    try {
      await onSave(client, manager);
      const company = engagements.find((e) => e.id === client)?.companyName ?? 'Client';
      toastSuccess('Client assigned', `${company} → ${managers.find((m) => m.id === manager)?.name ?? 'manager'}`);
      onOpenChange(false);
    } catch (err) {
      toastError('Could not assign the client', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fixedManager ? `Assign a client to ${fixedManager.name}` : 'Assign a client to a manager'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="text-[12.5px] text-ink-muted">Client</Label>
            {fixedClient ? (
              <p className="mt-1 text-[14px] font-medium text-ink">{fixedClient.companyName}</p>
            ) : (
              <Select value={client} onValueChange={setClient}>
                <SelectTrigger className="mt-1" aria-label="Client">
                  <SelectValue placeholder="Pick a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-[12.5px] text-ink-muted">Manager</Label>
            {fixedManager ? (
              <p className="mt-1 text-[14px] font-medium text-ink">{fixedManager.name}</p>
            ) : (
              <Select value={manager} onValueChange={setManager}>
                <SelectTrigger className="mt-1" aria-label="Manager">
                  <SelectValue placeholder="Pick a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers
                    .filter((m) => m.id !== fixedClient?.managerId)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!client || !manager || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Assign a task to a manager (prototype `AssignDialog` mode "task"): a client of theirs, a
 * title and a due date. Posts a task assigned to the manager's profile (`/api/tasks`); it shows
 * on the manager's Work as their own row.
 */
export function AssignManagerTaskDialog({
  open,
  onOpenChange,
  manager,
  engagements,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manager: ManagerOption | null;
  engagements: Engagement[];
}) {
  const queryClient = useQueryClient();
  const [client, setClient] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClient(engagements[0]?.id ?? '');
    setTitle('');
    setDue('');
  }, [open, engagements]);

  async function submit() {
    if (!manager || !client || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          engagementId: client,
          title: title.trim(),
          assigneeId: manager.id,
          dueAt: due ? `${due}T12:00:00+05:30` : null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Could not assign the task');
      toastSuccess(`Assigned to ${manager.name}`, title.trim());
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
    } catch (err) {
      toastError('Could not assign the task', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a task to {manager?.name ?? 'a manager'}</DialogTitle>
        </DialogHeader>
        <form
          id="assign-manager-task"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <Label className="text-[12.5px] text-ink-muted">Client</Label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger className="mt-1" aria-label="Client">
                <SelectValue placeholder="Pick a client" />
              </SelectTrigger>
              <SelectContent>
                {engagements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div>
              <Label htmlFor="manager-task-title" className="text-[12.5px] text-ink-muted">
                Task
              </Label>
              <Input id="manager-task-title" className="mt-1" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="manager-task-due" className="text-[12.5px] text-ink-muted">
                Due
              </Label>
              <Input id="manager-task-due" type="date" className="mt-1" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        </form>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="assign-manager-task" disabled={!client || !title.trim() || saving || !manager}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Resolve an escalation: the note the repository requires, then PATCH `/api/super/escalations/:id`. */
export function ResolveEscalationDialog({
  escalation,
  onOpenChange,
}: {
  escalation: { id: string; companyName: string; reason: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (escalation) setNote('');
  }, [escalation]);

  async function submit() {
    if (!escalation || !note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/super/escalations/${encodeURIComponent(escalation.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', note: note.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Could not resolve it');
      toastSuccess('Escalation resolved', escalation.companyName);
      await queryClient.invalidateQueries({ queryKey: ['escalations'] });
      onOpenChange(false);
    } catch (err) {
      toastError('Could not resolve it', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!escalation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve escalation</DialogTitle>
        </DialogHeader>
        {escalation ? (
          <div className="grid gap-3">
            <p className="text-[13.5px] text-ink-2">
              <span className="font-medium text-ink">{escalation.companyName}</span> · {escalation.reason}
            </p>
            <div>
              <Label htmlFor="escalation-note" className="text-[12.5px] text-ink-muted">
                Note
              </Label>
              <Textarea id="escalation-note" rows={3} className="mt-1" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!note.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
