'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Engagement } from '@/data/engagements';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

type LeadOption = { id: string; name: string };

/** Leads on one engagement: the `engagement_leads` rows and the primary lead. */
async function fetchLeads(engagementId: string): Promise<Array<{ internId: string; name: string }>> {
  const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/leads`);
  const body = (await res.json().catch(() => ({}))) as { leads?: Array<{ internId: string; name: string }>; error?: string };
  if (!res.ok) throw new Error(body.error || 'Could not load the leads');
  return body.leads ?? [];
}

/**
 * The manager's "Assign task" (prototype TodayScreen, G-12): a company from the manager's own
 * engagements, then one of that company's project leads, a title, a description and a due date.
 * Posts to `/api/tasks` with `leadId`; the task shows in the lead's Work list.
 */
export function AssignTaskDialog({
  open,
  onOpenChange,
  engagements,
  teamMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The manager's engagements (already scoped by the server). */
  engagements: Engagement[];
  /** Lead names by `intern_id` key, for the primary lead of a project. */
  teamMembers: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [engagementId, setEngagementId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const companies = useMemo(
    () =>
      engagements
        .filter((e) => e.internId || (e.leadIds ?? []).length > 0)
        .sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [engagements],
  );
  const engagement = companies.find((e) => e.id === engagementId) ?? null;

  useEffect(() => {
    if (!open) return;
    setEngagementId('');
    setLeadId('');
    setTitle('');
    setDescription('');
    setDeadline('');
  }, [open]);

  const leadsQuery = useQuery({
    queryKey: ['engagement-leads', engagementId],
    queryFn: () => fetchLeads(engagementId),
    enabled: open && Boolean(engagementId),
    staleTime: 60_000,
  });

  const leads = useMemo((): LeadOption[] => {
    if (!engagement) return [];
    const out = new Map<string, string>();
    for (const l of leadsQuery.data ?? []) out.set(l.internId, l.name);
    const nameOf = (key: string) => teamMembers.find((t) => t.id === key)?.name ?? 'Project lead';
    if (engagement.internId && !out.has(engagement.internId)) out.set(engagement.internId, nameOf(engagement.internId));
    for (const key of engagement.leadIds ?? []) if (!out.has(key)) out.set(key, nameOf(key));
    return [...out.entries()].map(([id, name]) => ({ id, name }));
  }, [engagement, leadsQuery.data, teamMembers]);

  // One lead on the company: pick them.
  useEffect(() => {
    if (leads.length === 1) setLeadId(leads[0]!.id);
    else if (!leads.some((l) => l.id === leadId)) setLeadId('');
  }, [leads, leadId]);

  const ready = Boolean(engagement && leadId && title.trim()) && !saving;

  async function submit() {
    if (!engagement || !leadId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          leadId,
          title: title.trim(),
          description: description.trim() || null,
          deadline: deadline || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Could not assign the task');
      const who = leads.find((l) => l.id === leadId)?.name ?? 'the lead';
      toastSuccess(`Assigned to ${who}`, `${title.trim()} · ${engagement.companyName}`);
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
          <DialogTitle>Assign task</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-[12.5px] text-ink-muted">Company</Label>
              <Select value={engagementId} onValueChange={setEngagementId}>
                <SelectTrigger className="mt-1" aria-label="Company">
                  <SelectValue placeholder="Pick a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12.5px] text-ink-muted">Project lead</Label>
              <Select value={leadId} onValueChange={setLeadId} disabled={!engagement || leads.length === 0}>
                <SelectTrigger className="mt-1" aria-label="Project lead">
                  <SelectValue placeholder={engagement ? 'Pick a lead' : 'Pick a company first'} />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div>
              <Label htmlFor="assign-lead-task-title" className="text-[12.5px] text-ink-muted">
                Title
              </Label>
              <Input
                id="assign-lead-task-title"
                className="mt-1"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="assign-lead-task-due" className="text-[12.5px] text-ink-muted">
                Deadline
              </Label>
              <Input
                id="assign-lead-task-due"
                type="date"
                className="mt-1"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="assign-lead-task-desc" className="text-[12.5px] text-ink-muted">
              Description
            </Label>
            <Textarea
              id="assign-lead-task-desc"
              rows={3}
              className="mt-1"
              value={description}
              maxLength={4000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-1 gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
