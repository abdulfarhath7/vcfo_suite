'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PersonAvatar } from '@/components/super/parts/super-parts';
import { shortCompany } from '@/components/super/parts/super-text';
import { errorMessage, toastEmailDispatch, toastError, toastSuccess } from '@/lib/toast-errors';
import type { EmailDispatchResult } from '@/lib/email/email-dispatch';
import type { SuperEngagementSummary } from '@/lib/super/super-overview';
import { cn } from '@/lib/utils';
import { useInvalidateSuperReads, type SuperStaff } from './use-super-staff';

const KEEP = '__keep';

/**
 * "Assign client" and "Reassign" (prototype `super/assign.tsx`, G-20): pick the client, the
 * project manager and, if it changes, the delivery lead. Saves through `/api/super/assign`,
 * which reuses the assignment repositories, sends the assignment emails and audits each change.
 */
export function AssignClientDialog({
  open,
  onOpenChange,
  engagementId,
  engagements,
  staff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client picked when the dialog opens; the first client when absent. */
  engagementId?: string;
  engagements: SuperEngagementSummary[];
  staff: SuperStaff;
}) {
  const invalidate = useInvalidateSuperReads();
  const [clientId, setClientId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [leadId, setLeadId] = useState(KEEP);
  const [saving, setSaving] = useState(false);

  const client = engagements.find((e) => e.id === clientId) ?? null;

  const pickClient = (id: string) => {
    setClientId(id);
    const next = engagements.find((e) => e.id === id);
    setManagerId(next?.managerId ?? '');
    setLeadId(KEEP);
  };

  useEffect(() => {
    if (!open) return;
    pickClient(engagementId ?? engagements[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the picks each time the dialog opens
  }, [open, engagementId]);

  /** Book size per manager, from the same scoped overview the rows come from. */
  const book = useMemo(() => {
    const out = new Map<string, { clients: number; open: number; late: number }>();
    for (const e of engagements) {
      if (!e.managerId) continue;
      const row = out.get(e.managerId) ?? { clients: 0, open: 0, late: 0 };
      row.clients += 1;
      row.open += e.ballInCourt.firm + e.ballInCourt.client;
      if (e.steps.overdue > 0) row.late += 1;
      out.set(e.managerId, row);
    }
    return out;
  }, [engagements]);

  const managerChanged = Boolean(client && managerId && managerId !== client.managerId);
  const leadChanged = Boolean(client && leadId !== KEEP && leadId !== client.leadId);

  async function confirm() {
    if (!client) return;
    if (!managerChanged && !leadChanged) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/super/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          engagementId: client.id,
          ...(managerChanged ? { managerId } : {}),
          ...(leadChanged ? { internId: leadId } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; email?: EmailDispatchResult | null };
      if (!res.ok) throw new Error(body.error || 'assign_failed');
      const managerName = staff.managers.find((m) => m.id === managerId)?.name;
      toastSuccess(`${shortCompany(client.companyName)} is now with ${managerName ?? 'the new team'}`);
      if (body.email) toastEmailDispatch(body.email);
      await invalidate();
      onOpenChange(false);
    } catch (err) {
      toastError('Could not assign', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{engagementId ? 'Reassign' : 'Assign a client to a manager'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="text-[12.5px] text-ink-muted">Client</Label>
            <Select value={clientId} onValueChange={pickClient}>
              <SelectTrigger className="mt-1" aria-label="Client">
                <SelectValue placeholder="Pick a client" />
              </SelectTrigger>
              <SelectContent>
                {engagements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {shortCompany(e.companyName)} · {e.managerName ?? 'No manager'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[12.5px] text-ink-muted">Manager</legend>
            {staff.managers.length === 0 ? (
              <p className="text-[13px] text-ink-muted">{staff.isPending ? 'Loading managers' : 'No managers yet'}</p>
            ) : (
              <div role="radiogroup" aria-label="Manager" className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {staff.managers.map((m) => {
                  const on = managerId === m.id;
                  const b = book.get(m.id) ?? { clients: 0, open: 0, late: 0 };
                  const admin = staff.adminNameOf(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setManagerId(m.id)}
                      className={cn(
                        'flex min-w-0 items-center gap-2.5 rounded-md border-1.5 px-3 py-2.5 text-left',
                        on ? 'border-brand-line bg-brand-soft' : 'border-line hover:bg-surface-sunken',
                      )}
                    >
                      <PersonAvatar name={m.name} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{m.name}</span>
                        <span className="block truncate text-[12px] text-ink-muted">
                          {b.clients} clients · {b.open} open · {b.late} late{admin ? ` · under ${admin}` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div>
            <Label className="text-[12.5px] text-ink-muted">Project lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger className="mt-1" aria-label="Project lead">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>{client?.leadName ? `Keep ${client.leadName}` : 'No change'}</SelectItem>
                {staff.leads.map((l) => (
                  <SelectItem key={l.id} value={l.internId ?? l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-2 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={!client || !managerId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
