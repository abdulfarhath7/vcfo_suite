'use client';

import Link from 'next/link';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Surface, Eyebrow, EmptyStateIllustrated } from '@/components/noir';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Briefcase, Eye, EyeOff, Loader2, Plus, UserMinus, Users, UserSquare2 } from 'lucide-react';
import { adminProjectPath } from '@/lib/projects/project-step-path';
import { TEMP_PASSWORD, ROLE_LABEL } from './firm-people/types';
import { useFirmPeople } from './firm-people/use-firm-people';
import { createPersonRow } from './firm-people/person-row';
import { createFirmPeopleDialogs } from './firm-people/dialogs';
import { renderManagerView } from './firm-people/manager-view';

/** Birds-eye people + portfolio for Admin and Project Manager. */
export default function FirmPeople() {
  const state = useFirmPeople();
  const PersonRow = createPersonRow(state);
  const dialogs = createFirmPeopleDialogs(state);
  const { selectedManagerId, isAdmin } = state;

  if (selectedManagerId && isAdmin) {
    return renderManagerView({ ...state, ...dialogs, PersonRow });
  }

  const {
    user,
    staffBase,
    createOpen,
    setCreateOpen,
    showPassword,
    setShowPassword,
    isManager,
    canCreate,
    createRoles,
    form,
    dispatch,
    onCreate,
    admins,
    managers,
    leads,
    clients,
    removedClients,
    portfolio,
    leadName,
    managerName,
    openManager,
    openCreate,
  } = state;
  const {
    assignDialog,
    emailDialog,
  } = dialogs;

  return (
    <PageTransition>
      <SEO title="People — VCFO Suite" description="Portfolio people overview." path={`${staffBase}/people`} />
      <PageHeader
        accent="violet"
        icon={Users}
        title="People"
        actions={
          canCreate ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                dispatch({
                  type: 'patch',
                  patch: { role: isAdmin ? 'manager' : 'intern', password: TEMP_PASSWORD },
                });
                setCreateOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create person
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {isAdmin && (
          <Surface className="divide-y divide-line">
            <div className="px-4 py-3">
              <Eyebrow>Admins</Eyebrow>
            </div>
            {admins.length === 0 ? (
              <EmptyStateIllustrated
                icon={Users}
                title="No admins"
                className="m-4 py-8"
              />
            ) : (
              admins.map((m) => (
                <PersonRow
                  key={m.id}
                  person={m}
                  canManage={isAdmin && m.id !== user?.id && m.role !== 'super_admin'}
                />
              ))
            )}
          </Surface>
        )}

        {isAdmin && (
          <Surface className="divide-y divide-line">
            <div className="px-4 py-3">
              <Eyebrow>Managers</Eyebrow>
            </div>
            {managers.length === 0 ? (
              <EmptyStateIllustrated
                icon={Users}
                title="No managers yet"
                actionLabel="Create manager"
                onAction={() => openCreate('manager')}
                className="m-4 py-8"
              />
            ) : (
              managers.map((m) => {
                const book = portfolio.rows.filter((c) => c.managerId === m.id);
                return (
                  <PersonRow
                    key={m.id}
                    person={m}
                    meta={`${book.length} project${book.length === 1 ? '' : 's'} · ${book.filter((b) => b.stuck).length} at risk`}
                    canManage={isAdmin}
                    canAssign={isAdmin}
                    onOpen={() => openManager(m.id)}
                  />
                );
              })
            )}
          </Surface>
        )}

        <Surface className="divide-y divide-line">
          <div className="px-4 py-3">
            <Eyebrow>Project leads</Eyebrow>
          </div>
          {leads.length === 0 ? (
            <EmptyStateIllustrated
              icon={Users}
              title="No project leads yet"
              actionLabel={canCreate ? 'Create lead' : undefined}
              onAction={canCreate ? () => openCreate('intern') : undefined}
              className="m-4 py-8"
            />
          ) : (
            leads.map((m) => (
              <PersonRow
                key={m.id}
                person={m}
                meta={
                  isAdmin && m.reportsToManagerId
                    ? `Reports to ${managerName(m.reportsToManagerId)}`
                    : undefined
                }
                canManage={isAdmin || isManager}
                canAssign={isAdmin || isManager}
              />
            ))
          )}
        </Surface>

        <Surface className="divide-y divide-line">
          <div className="px-4 py-3">
            <Eyebrow>Client accounts</Eyebrow>
          </div>
          {clients.length === 0 ? (
            <EmptyStateIllustrated
              icon={UserSquare2}
              title="No client logins yet"
              className="m-4 py-8"
            />
          ) : (
            clients.map((m) => (
              <PersonRow
                key={m.id}
                person={m}
                canManage={isAdmin}
              />
            ))
          )}
        </Surface>

        <Surface className="divide-y divide-line lg:col-span-2">
          <div className="px-4 py-3">
            <Eyebrow>Removed clients</Eyebrow>
          </div>
          {removedClients.length === 0 ? (
            <EmptyStateIllustrated
              icon={UserMinus}
              title="No removed clients"
              className="m-4 py-8"
            />
          ) : (
            removedClients.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="text-[13px] font-medium">{c.name}</div>
                <div className="font-mono text-[11px] text-ink-muted">{c.email}</div>
                {c.phone ? (
                  <div className="font-mono text-[11px] text-ink-muted">{c.phone}</div>
                ) : null}
                <div className="mt-1 text-[11px] text-ink-muted">
                  {c.removedReason ?? 'Removed from their last project'}
                  {c.removedAt ? ` · ${new Date(c.removedAt).toLocaleDateString()}` : ''}
                </div>
              </div>
            ))
          )}
        </Surface>
      </div>

      <Surface className="mt-4 divide-y divide-line">
        <div className="px-4 py-3">
          <Eyebrow>Clients & projects</Eyebrow>
        </div>
        {portfolio.rows.length === 0 ? (
          <EmptyStateIllustrated
            icon={Briefcase}
            title="No active projects"
            className="m-4 py-8"
          />
        ) : (
          portfolio.rows.map((c) => (
            <Link
              key={c.id}
              href={adminProjectPath({ id: c.id, slug: c.slug }, staffBase)}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-surface-sunken/40"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{c.company}</div>
                <div className="text-[11px] text-ink-muted">
                  Client {c.client} · PM {managerName(c.managerId)} · Lead {leadName(c.leadId)}
                </div>
              </div>
              <div className="text-[11px] mono text-ink-muted">
                {c.stage} · {c.health}
              </div>
            </Link>
          ))
        )}
      </Surface>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create person</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {createRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => dispatch({ type: 'patch', patch: { role: r } })}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] ${
                    form.role === r
                      ? 'border-brand bg-brand-soft text-brand-strong'
                      : 'border-line'
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-[12px]">Full name</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => dispatch({ type: 'patch', patch: { name: e.target.value } })}
              />
            </div>
            <div>
              <Label className="text-[12px]">Work email</Label>
              <Input
                className="mt-1"
                type="email"
                required
                value={form.email}
                onChange={(e) => dispatch({ type: 'patch', patch: { email: e.target.value } })}
              />
            </div>
            <div>
              <Label className="text-[12px]">Temporary password</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => dispatch({ type: 'patch', patch: { password: e.target.value } })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {form.role === 'intern' && isAdmin && (
              <div>
                <Label className="text-[12px]">Reports to (project manager)</Label>
                <Select
                  value={form.reportsToManagerId}
                  onValueChange={(v) =>
                    dispatch({ type: 'patch', patch: { reportsToManagerId: v } })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.submitting} className="gap-2">
                {form.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {assignDialog}
      {emailDialog}
    </PageTransition>
  );
}
