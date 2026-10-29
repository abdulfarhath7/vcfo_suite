'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TeamTaskRow } from '@/components/staff/today/today-rows';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

type Scope = 'item' | 'lead';

/** Steps and tasks move one at a time; filings and requests move with the whole client. */
export function canMoveItem(row: Pick<TeamTaskRow, 'source' | 'itemId'>): boolean {
  return Boolean(row.itemId) && (row.source === 'step' || row.source === 'task');
}

/**
 * Reassign (prototype `ReassignDialog`, G-18): move one step or task to another project lead,
 * or the whole client from this lead to another. Posts to `/api/work/reassign`, which uses the
 * existing assignment repositories and writes the audit event.
 */
export function ReassignDialog({
  row,
  onOpenChange,
  leads,
  onDone,
}: {
  row: TeamTaskRow | null;
  onOpenChange: (open: boolean) => void;
  leads: Array<{ id: string; name: string }>;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>('item');
  const [to, setTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!row) return;
    setScope(canMoveItem(row) ? 'item' : 'lead');
    setTo('');
    setNote('');
  }, [row]);

  const options = leads.filter((l) => l.id !== row?.leadId);

  async function submit() {
    if (!row || !to) return;
    setSaving(true);
    try {
      const body =
        scope === 'item'
          ? { kind: 'item', engagementId: row.engagementId, itemKey: row.itemId, toLeadId: to, note: note.trim() || null }
          : { kind: 'lead', engagementId: row.engagementId, fromLeadId: row.leadId, toLeadId: to, note: note.trim() || null };
      const res = await fetch('/api/work/reassign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error || 'Could not reassign');
      const who = leads.find((l) => l.id === to)?.name ?? 'the new lead';
      toastSuccess(
        `Reassigned to ${who}`,
        scope === 'item' ? `${row.title} · ${row.companyName}` : row.companyName,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['engagements'] }),
        queryClient.invalidateQueries({ queryKey: ['checklist-index'] }),
      ]);
      onDone?.();
      onOpenChange(false);
    } catch (err) {
      toastError('Could not reassign', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign</DialogTitle>
          {row ? (
            <DialogDescription className="truncate">
              {row.title} · now with {row.leadName}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {row ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset>
              <legend className="mb-1.5 text-[12.5px] font-medium text-ink-muted">What moves</legend>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="grid gap-2">
                {canMoveItem(row) ? (
                  <label className="flex items-center gap-2 text-[13.5px]">
                    <RadioGroupItem value="item" />
                    {row.source === 'task' ? 'This task' : 'This step'}
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-[13.5px]">
                  <RadioGroupItem value="lead" />
                  All of {row.companyName}
                </label>
              </RadioGroup>
            </fieldset>
            <div>
              <Label className="text-[12.5px] text-ink-muted">Project lead</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="mt-1" aria-label="Project lead">
                  <SelectValue placeholder="Pick a lead" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reassign-note" className="text-[12.5px] text-ink-muted">
                Note
              </Label>
              <Textarea
                id="reassign-note"
                rows={2}
                className="mt-1"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={!to || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Reassign
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
