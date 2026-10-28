'use client';

import { sep } from '@/lib/date-format';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { EmptyState } from '@/components/ui/empty-state';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
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
import { Eye, EyeOff, Loader2, Plus, Users } from 'lucide-react';
import { TEMP_PASSWORD, ROLE_LABEL } from './firm-people/types';
import { useFirmPeople } from './firm-people/use-firm-people';
import { createPersonRow } from './firm-people/person-row';
import { createFirmPeopleDialogs } from './firm-people/dialogs';
import { renderManagerView } from './firm-people/manager-view';
import { PeopleCard, PeopleProjectsGrid } from './firm-people/parts';

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
          <PeopleCard title="Admins" count={admins.length}>
            {admins.length === 0 ? (
              <EmptyState title="No admins" className="m-4" />
            ) : (
              admins.map((m) => (
                <PersonRow
                  key={m.id}
                  person={m}
                  canManage={isAdmin && m.id !== user?.id && m.role !== 'super_admin'}
                />
              ))
            )}
          </PeopleCard>
        )}

        {isAdmin && (
          <PeopleCard title="Managers" count={managers.length}>
            {managers.length === 0 ? (
              <EmptyState
                title="No managers yet"
                className="m-4"
                action={
                  <Button size="sm" onClick={() => openCreate('manager')}>
                    Create manager
                  </Button>
                }
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
          </PeopleCard>
        )}

        <PeopleCard title="Project leads" count={leads.length}>
          {leads.length === 0 ? (
            <EmptyState
              title="No project leads yet"
              className="m-4"
              action={
                canCreate ? (
                  <Button size="sm" onClick={() => openCreate('intern')}>
                    Create lead
                  </Button>
                ) : undefined
              }
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
        </PeopleCard>

        <PeopleCard title="Client accounts" count={clients.length}>
          {clients.length === 0 ? (
            <EmptyState title="No client logins yet" className="m-4" />
          ) : (
            clients.map((m) => (
              <PersonRow
                key={m.id}
                person={m}
                canManage={isAdmin}
              />
            ))
          )}
        </PeopleCard>

        <PeopleCard title="Removed clients" count={removedClients.length} className="lg:col-span-2">
          {removedClients.length === 0 ? (
            <EmptyState title="No removed clients" className="m-4" />
          ) : (
            removedClients.map((c) => (
              <div key={c.id} className="border-b border-line-soft px-4 py-2.5 last:border-b-0">
                <div className="text-[14px] font-medium text-ink">{c.name}</div>
                <div className="text-[12.5px] text-ink-muted">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ''}
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink-muted">
                  {c.removedReason ?? 'Removed from their last project'}
                  {c.removedAt ? ` · ${sep(new Date(c.removedAt).toLocaleDateString())}` : ''}
                </div>
              </div>
            ))
          )}
        </PeopleCard>
      </div>

      <PeopleCard title="Clients & projects" count={portfolio.rows.length} className="mt-4">
        {portfolio.rows.length === 0 ? (
          <EmptyState title="No active projects" className="m-4" />
        ) : (
          <PeopleProjectsGrid
            rows={portfolio.rows}
            staffBase={staffBase}
            managerName={managerName}
            leadName={leadName}
          />
        )}
      </PeopleCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create person</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3">
            <SpectrumTabs
              size="md"
              label="Role"
              items={createRoles.map((r) => ({ key: r, label: ROLE_LABEL[r] }))}
              value={form.role}
              onChange={(r) => dispatch({ type: 'patch', patch: { role: r as typeof form.role } })}
            />
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
