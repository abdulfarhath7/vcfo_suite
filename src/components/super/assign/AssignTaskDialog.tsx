'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { shortCompany } from '@/components/super/parts/super-text';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import type { SuperEngagementSummary } from '@/lib/super/super-overview';
import type { SuperStaff } from './use-super-staff';

/**
 * "Assign task" (prototype `AssignDialog` in task mode, G-20): one piece of work on one client,
 * for a manager or a project lead, with a due date. Posts to the existing `/api/tasks` route,
 * which checks the caller can reach the engagement.
 */
export function AssignTaskDialog({
  open,
  onOpenChange,
  engagementId,
  engagements,
  staff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId?: string;
  engagements: SuperEngagementSummary[];
  staff: SuperStaff;
}) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = engagementId ?? engagements[0]?.id ?? '';
    setClientId(id);
    setAssigneeId(engagements.find((e) => e.id === id)?.managerId ?? '');
    setTitle('');
    setDue('');
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the form each time the dialog opens
  }, [open, engagementId]);

  const people = [...staff.managers.map((m) => ({ ...m, kind: 'Manager' })), ...staff.leads.map((l) => ({ ...l, kind: 'Lead' }))];
  const client = engagements.find((e) => e.id === clientId) ?? null;

  async function confirm() {
    if (!client || !title.trim() || !assigneeId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          engagementId: client.id,
          title: title.trim(),
          assigneeId,
          dueAt: due ? new Date(`${due}T12:00:00`).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'create_failed');
      const who = people.find((p) => p.id === assigneeId)?.name ?? 'them';
      toastSuccess(`Assigned to ${who}`, `${title.trim()} · ${shortCompany(client.companyName)}`);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="text-[12.5px] text-ink-muted">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1" aria-label="Client">
                <SelectValue placeholder="Pick a client" />
              </SelectTrigger>
              <SelectContent>
                {engagements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {shortCompany(e.companyName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div>
              <Label htmlFor="assign-task-title" className="text-[12.5px] text-ink-muted">Task</Label>
              <Input id="assign-task-title" className="mt-1" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="assign-task-due" className="text-[12.5px] text-ink-muted">Due</Label>
              <Input id="assign-task-due" type="date" className="mt-1" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-[12.5px] text-ink-muted">Assign to</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="mt-1" aria-label="Assign to">
                <SelectValue placeholder="Pick a person" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="assign-task-notes" className="text-[12.5px] text-ink-muted">Notes</Label>
            <Textarea id="assign-task-notes" rows={3} className="mt-1" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="mt-2 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={!client || !title.trim() || !assigneeId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
