'use client';

import { useState } from 'react';
import { MessageCircle, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTeam, type TeamMember } from '@/hooks/use-receivables-v2';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { ROW_BTN, TD, TH, errorText } from './shared';

/**
 * The Team sub-tab (owner, 20 Nov 2026): the people who run this sheet. Each has a role, an email
 * and a WhatsApp number; "WhatsApp" sends them the sheet's updates (emails waiting for approval,
 * sent, skipped, failed, payments received) and "Can approve" lets them approve the waiting
 * emails, which then go from their own Outlook. Adding a new email makes a login that opens only
 * the sheets it is added to and emails a set-password link. The manager is always on the team.
 */
const EMPTY = { name: '', role: '', email: '', phone: '' };

export function TeamPane({ sheetId }: { sheetId: string }) {
  const { query, add, update, remove } = useTeam(sheetId);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const team = query.data?.team ?? [];
  const save = (m: TeamMember, patch: Partial<TeamMember>) =>
    update.mutate({ userId: m.userId, ...patch, phone: patch.phone === undefined ? undefined : patch.phone }, { onError: (e) => toastError('Not saved', errorText(e)) });
  const submit = () => {
    if (!form.email.trim()) return;
    add.mutate(
      { name: form.name, role: form.role, email: form.email, phone: form.phone || null },
      {
        onSuccess: (r) => {
          toastSuccess(`${r.member.name} added`, r.emailed ? 'They got an email to sign in.' : 'The email could not go out; they can use “Forgot password”.');
          setForm(EMPTY);
          setAdding(false);
        },
        onError: (e) => toastError('Not added', errorText(e)),
      },
    );
  };
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-raised">
      <div className="flex h-10 items-center justify-between border-b border-line bg-surface-sunken pl-4 pr-2">
        <span className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-muted">{`Team · ${team.length}`}</span>
        <span className="flex items-center gap-3">
          <span className="text-[11.5px] text-ink-muted">Everyone with WhatsApp on hears what happens; anyone with “Can approve” can approve and send emails.</span>
          <Button size="iconSm" variant="quiet" className="!h-7 !w-7" aria-label={adding ? 'Close the add member form' : 'Add a team member'} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
            {adding ? <X aria-hidden /> : <Plus aria-hidden />}
          </Button>
        </span>
      </div>
      {adding ? (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-sunken px-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input className="h-8 min-w-[140px] flex-1 text-[13px]" aria-label="Name" placeholder="Name" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input className="h-8 w-[140px] text-[13px]" aria-label="Role" placeholder="Role (e.g. Accounts)" value={form.role} maxLength={60} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <Input className="h-8 min-w-[200px] flex-1 text-[13px]" aria-label="Email" placeholder="Email" type="email" value={form.email} maxLength={200} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input className="h-8 w-[170px] text-[13px]" aria-label="WhatsApp number" placeholder="WhatsApp +91…" inputMode="tel" value={form.phone} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button size="sm" type="submit" disabled={!form.email.trim() || add.isPending}>
            {add.isPending ? 'Adding…' : 'Add'}
          </Button>
        </form>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Role</th>
              <th className={TH}>Email</th>
              <th className={TH}>WhatsApp number</th>
              <th className={TH}>WhatsApp</th>
              <th className={TH}>Can approve</th>
              <th className={TH}>
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.userId}>
                <td className={TD}>
                  <span className="font-medium text-ink">{m.name}</span>
                  {m.invitePending ? <span className="ml-2 text-[11.5px] text-warning">invited, no password yet</span> : null}
                </td>
                <td className={TD}>
                  {m.isManager ? (
                    <span className="text-ink-2">Manager</span>
                  ) : (
                    <Input className="h-7 w-[140px] text-[13px]" aria-label={`Role of ${m.name}`} defaultValue={m.role} maxLength={60} onBlur={(e) => e.target.value !== m.role && save(m, { role: e.target.value })} />
                  )}
                </td>
                <td className={`${TD} text-ink-2`}>{m.email}</td>
                <td className={TD}>
                  <Input
                    className={`h-7 w-[160px] text-[13px] ${m.phone ? '' : 'border-warning'}`}
                    aria-label={`WhatsApp number of ${m.name}`}
                    placeholder="not added"
                    inputMode="tel"
                    defaultValue={m.phone ?? ''}
                    maxLength={30}
                    onBlur={(e) => e.target.value.trim() !== (m.phone ?? '') && save(m, { phone: e.target.value.trim() || null })}
                  />
                </td>
                <td className={TD}>
                  <span className="inline-flex items-center gap-1.5">
                    <Switch size="sm" aria-label={`WhatsApp updates for ${m.name}`} checked={m.whatsappUpdates} disabled={m.isManager} onCheckedChange={(v) => save(m, { whatsappUpdates: v })} />
                    {m.whatsappUpdates && !m.phone ? <MessageCircle aria-label="No number yet" className="size-3.5 text-warning" /> : null}
                  </span>
                </td>
                <td className={TD}>
                  <Switch size="sm" aria-label={`${m.name} can approve`} checked={m.canApprove} disabled={m.isManager} onCheckedChange={(v) => save(m, { canApprove: v })} />
                </td>
                <td className={`${TD} text-right`}>
                  {m.isManager ? null : (
                    <Button
                      size="sm"
                      variant="quiet"
                      className={ROW_BTN}
                      aria-label={`Remove ${m.name} from the team`}
                      onClick={() => {
                        if (window.confirm(`Take ${m.name} off this sheet's team? Their login stays.`)) remove.mutate(m.userId, { onError: (e) => toastError('Not removed', errorText(e)) });
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.isLoading ? <p className="px-4 py-4 text-center text-[13px] text-ink-muted">Loading the team…</p> : null}
        {query.error ? <p className="px-4 py-4 text-center text-[13px] text-danger">{query.error.message}</p> : null}
      </div>
    </div>
  );
}
