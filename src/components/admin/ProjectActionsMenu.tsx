'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { isFirmWideAdmin } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import {
  Loader2,
  MoreHorizontal,
  UserMinus,
  UserPlus,
  UserRoundCog,
  UserRoundPlus,
} from 'lucide-react';
import type { Engagement } from '@/data/engagements';

type DialogKind =
  | 'add-manager'
  | 'change-manager'
  | 'delete-manager'
  | 'add-lead'
  | 'change-lead'
  | 'delete-lead';

type LeadRow = { internId: string; name: string; email: string; isPrimary: boolean };
type PersonOption = { id: string; name: string; email: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `http_${res.status}`);
  return body as T;
}

function leadIdsOf(engagement: Engagement): string[] {
  if (engagement.leadIds && engagement.leadIds.length > 0) return engagement.leadIds;
  return engagement.internId?.trim() ? [engagement.internId] : [];
}

/**
 * Kebab menu: one manager per project; many leads.
 * Admin — manager add/change/delete + lead add/change/delete.
 * Manager — lead add/change/delete only.
 */
export function ProjectActionsMenu({
  engagement,
  className,
}: {
  engagement: Engagement;
  className?: string;
}) {
  const { user, updateEngagement } = useApp();
  const queryClient = useQueryClient();
  const isAdmin = isFirmWideAdmin(user?.role);
  const isManager = user?.role === 'manager';
  const canEdit = isAdmin || isManager;

  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [managerId, setManagerId] = useState('');
  const [internId, setInternId] = useState('');
  const [fromInternId, setFromInternId] = useState('');

  const managersQuery = useQuery({
    queryKey: ['admin-managers'],
    queryFn: () =>
      fetchJson<{ managers: PersonOption[] }>('/api/admin/managers').then((d) => d.managers),
    staleTime: 5 * 60_000,
    enabled: dialog === 'add-manager' || dialog === 'change-manager',
  });

  const internsQuery = useQuery({
    queryKey: ['admin-interns'],
    queryFn: () =>
      fetchJson<{ interns: PersonOption[] }>('/api/admin/interns').then((d) => d.interns),
    staleTime: 5 * 60_000,
    enabled:
      dialog === 'add-lead' || dialog === 'change-lead' || dialog === 'delete-lead',
  });

  const leadsQuery = useQuery({
    queryKey: ['engagement-leads', engagement.id],
    queryFn: () =>
      fetchJson<{ leads: LeadRow[] }>(`/api/engagements/${engagement.id}/leads`).then(
        (d) => d.leads,
      ),
    enabled:
      dialog === 'add-lead' || dialog === 'change-lead' || dialog === 'delete-lead',
  });

  if (!canEdit) return null;

  const assignedLeadIds = leadIdsOf(engagement);
  const hasLeads = assignedLeadIds.length > 0;
  const hasManager = Boolean(engagement.managerId?.trim());

  async function refreshEngagements() {
    await queryClient.invalidateQueries({ queryKey: ['engagements', user?.id] });
    await queryClient.invalidateQueries({ queryKey: ['engagement-leads', engagement.id] });
  }

  function open(kind: DialogKind) {
    setManagerId(engagement.managerId ?? '');
    setInternId('');
    setFromInternId(assignedLeadIds[0] ?? '');
    setDialog(kind);
  }

  async function save() {
    if (!dialog) return;
    setSaving(true);
    try {
      if (dialog === 'add-manager' || dialog === 'change-manager') {
        if (!managerId) return;
        await updateEngagement(engagement.id, { managerId });
        toastSuccess(
          dialog === 'add-manager' ? 'Manager assigned' : 'Manager updated',
          engagement.companyName,
        );
      } else if (dialog === 'delete-manager') {
        await updateEngagement(engagement.id, { managerId: null });
        toastSuccess('Manager removed', engagement.companyName);
      } else if (dialog === 'add-lead') {
        if (!internId) return;
        await fetchJson(`/api/engagements/${engagement.id}/leads`, {
          method: 'POST',
          body: JSON.stringify({ internId }),
        });
        toastSuccess('Lead added', engagement.companyName);
        await refreshEngagements();
      } else if (dialog === 'change-lead') {
        if (!fromInternId || !internId) return;
        await fetchJson(`/api/engagements/${engagement.id}/leads`, {
          method: 'POST',
          body: JSON.stringify({ fromInternId, toInternId: internId }),
        });
        toastSuccess('Lead updated', engagement.companyName);
        await refreshEngagements();
      } else if (dialog === 'delete-lead') {
        if (!fromInternId) return;
        await fetchJson(`/api/engagements/${engagement.id}/leads`, {
          method: 'DELETE',
          body: JSON.stringify({ internId: fromInternId }),
        });
        toastSuccess('Lead removed', engagement.companyName);
        await refreshEngagements();
      }
      setDialog(null);
    } catch (err) {
      toastError("Couldn't update project", errorMessage(err, 'Try again in a moment.'));
    } finally {
      setSaving(false);
    }
  }

  const assignedSet = new Set(
    (leadsQuery.data ?? []).map((l) => l.internId).concat(assignedLeadIds),
  );
  const availableLeads = (internsQuery.data ?? []).filter((p) => !assignedSet.has(p.id));
  const currentLeads: LeadRow[] =
    leadsQuery.data ??
    assignedLeadIds.map((id) => ({
      internId: id,
      name: (internsQuery.data ?? []).find((p) => p.id === id)?.name ?? id,
      email: '',
      isPrimary: id === engagement.internId,
    }));

  const saveDisabled =
    saving ||
    ((dialog === 'add-manager' || dialog === 'change-manager') && !managerId) ||
    (dialog === 'add-lead' && !internId) ||
    (dialog === 'change-lead' && (!fromInternId || !internId)) ||
    (dialog === 'delete-lead' && !fromInternId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Project settings for ${engagement.companyName}`}
            onClick={(ev) => ev.stopPropagation()}
            className={
              className ??
              'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground'
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52" onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenuLabel className="max-w-48 truncate text-[11px] font-normal text-muted-foreground">
            {engagement.companyName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isAdmin ? (
            <>
              {hasManager ? (
                <DropdownMenuItem onSelect={() => open('change-manager')}>
                  <UserRoundCog className="mr-2 h-3.5 w-3.5 text-accent-violet" />
                  Change manager
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => open('add-manager')}>
                  <UserPlus className="mr-2 h-3.5 w-3.5 text-accent-violet" />
                  Add manager
                </DropdownMenuItem>
              )}
              {hasManager ? (
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onSelect={() => open('delete-manager')}
                >
                  <UserMinus className="mr-2 h-3.5 w-3.5" />
                  Delete manager
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}

          {/* Leads — always allow Add (multi-lead). Change/Delete when any exist. */}
          <DropdownMenuItem onSelect={() => open('add-lead')}>
            <UserRoundPlus className="mr-2 h-3.5 w-3.5 text-accent-sky" />
            Add lead
          </DropdownMenuItem>
          {hasLeads ? (
            <>
              <DropdownMenuItem onSelect={() => open('change-lead')}>
                <UserRoundCog className="mr-2 h-3.5 w-3.5 text-accent-sky" />
                Change lead
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-danger focus:text-danger"
                onSelect={() => open('delete-lead')}
              >
                <UserMinus className="mr-2 h-3.5 w-3.5" />
                Delete lead
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="max-w-sm" onClick={(ev) => ev.stopPropagation()}>
          {dialog === 'add-manager' || dialog === 'change-manager' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-[17px]">
                  {dialog === 'add-manager' ? 'Add project manager' : 'Change project manager'}
                </DialogTitle>
                <DialogDescription className="text-[12px]">
                  {engagement.companyName} — one manager per project.
                </DialogDescription>
              </DialogHeader>
              <div className="py-1">
                <Label className="text-[12px]">Project manager</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                    <SelectValue
                      placeholder={
                        managersQuery.isLoading ? 'Loading managers…' : 'Select manager'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(managersQuery.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {dialog === 'delete-manager' ? (
            <DialogHeader>
              <DialogTitle className="text-[17px]">Remove project manager?</DialogTitle>
              <DialogDescription className="text-[12px]">
                {engagement.companyName} will have no manager until you assign one.
              </DialogDescription>
            </DialogHeader>
          ) : null}

          {dialog === 'add-lead' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-[17px]">Add delivery lead</DialogTitle>
                <DialogDescription className="text-[12px]">
                  {engagement.companyName} — projects can have multiple leads.
                  {assignedLeadIds.length > 0
                    ? ` Currently ${assignedLeadIds.length}.`
                    : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="py-1">
                <Label className="text-[12px]">Delivery lead</Label>
                <Select value={internId} onValueChange={setInternId}>
                  <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                    <SelectValue
                      placeholder={
                        internsQuery.isLoading ? 'Loading leads…' : 'Select lead to add'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLeads.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableLeads.length === 0 && !internsQuery.isLoading ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Every available lead is already on this project.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {dialog === 'change-lead' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-[17px]">Change delivery lead</DialogTitle>
                <DialogDescription className="text-[12px]">
                  {engagement.companyName} — replace one lead with another.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div>
                  <Label className="text-[12px]">Current lead</Label>
                  <Select value={fromInternId} onValueChange={setFromInternId}>
                    <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                      <SelectValue placeholder="Select lead to replace" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentLeads.map((m) => (
                        <SelectItem key={m.internId} value={m.internId}>
                          {m.name}
                          {m.isPrimary ? ' (primary)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[12px]">Replace with</Label>
                  <Select value={internId} onValueChange={setInternId}>
                    <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                      <SelectValue placeholder="Select new lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLeads.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : null}

          {dialog === 'delete-lead' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-[17px]">Remove delivery lead?</DialogTitle>
                <DialogDescription className="text-[12px]">
                  {engagement.companyName} — pick which lead to remove.
                </DialogDescription>
              </DialogHeader>
              <div className="py-1">
                <Label className="text-[12px]">Lead to remove</Label>
                <Select value={fromInternId} onValueChange={setFromInternId}>
                  <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                    <SelectValue placeholder="Select lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentLeads.map((m) => (
                      <SelectItem key={m.internId} value={m.internId}>
                        {m.name}
                        {m.isPrimary ? ' (primary)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-2"
              variant={
                dialog === 'delete-manager' || dialog === 'delete-lead'
                  ? 'destructive'
                  : 'default'
              }
              disabled={saveDisabled}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {dialog === 'delete-manager' || dialog === 'delete-lead' ? 'Remove' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
