'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
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
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import {
  Briefcase,
  Check,
  Eye,
  EyeOff,
  FolderPlus,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Trash2,
  UserMinus,
  Users,
  UserSquare2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { adminProjectPath } from '@/lib/project-step-path';
import { deriveStuckReason } from '@/lib/project-stuck';
import { isFirmWideAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';

const TEMP_PASSWORD = 'SBC@2026';

type PersonRole = 'super_admin' | 'admin' | 'manager' | 'intern' | 'client';

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: PersonRole;
  internId?: string | null;
  clientId?: string | null;
  reportsToManagerId?: string | null;
  status?: string;
};

type RemovedClientRow = {
  id: string;
  name: string;
  email: string;
  clientId: string | null;
  phone: string | null;
  removedAt: string | null;
  removedReason: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `http_${res.status}`);
  return body as T;
}

type FormState = {
  name: string;
  email: string;
  password: string;
  role: PersonRole;
  reportsToManagerId: string;
  submitting: boolean;
};

type FormAction = { type: 'patch'; patch: Partial<FormState> } | { type: 'reset' };

function formReducer(state: FormState, action: FormAction): FormState {
  if (action.type === 'reset') {
    return {
      name: '',
      email: '',
      password: TEMP_PASSWORD,
      role: state.role,
      reportsToManagerId: state.reportsToManagerId,
      submitting: false,
    };
  }
  return { ...state, ...action.patch };
}

const ROLE_LABEL: Record<PersonRole, string> = {
  super_admin: 'Super admin',
  admin: 'Firm admin',
  manager: 'Project manager',
  intern: 'Project lead',
  client: 'Client',
};

/** Birds-eye people + portfolio for Admin and Project Manager. */
export default function FirmPeople() {
  const { engagements, user, teamMembers, getStateForEngagement, updateEngagement } = useApp();
  const staffBase = useStaffBasePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<StaffRow | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [assignTarget, setAssignTarget] = useState<StaffRow | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const isAdmin = isFirmWideAdmin(user?.role);
  const isManager = user?.role === 'manager';
  const canCreate = isAdmin || isManager;
  const createRoles: PersonRole[] = isAdmin
    ? ['admin', 'manager', 'intern']
    : ['intern'];
  const selectedManagerId = searchParams.get('managerId');

  const peopleQuery = useQuery({
    queryKey: ['admin-people'],
    queryFn: async () => {
      const data = await fetchJson<{ people: StaffRow[] }>('/api/admin/people');
      return data.people;
    },
    enabled: isAdmin,
  });

  const internsQuery = useQuery({
    queryKey: ['admin-interns'],
    queryFn: async () => {
      const data = await fetchJson<{
        interns: {
          id: string;
          profileId: string;
          name: string;
          email: string;
          reportsToManagerId?: string | null;
        }[];
      }>('/api/admin/interns');
      return data.interns;
    },
    enabled: isManager,
  });

  const clientsQuery = useQuery({
    queryKey: ['admin-clients'],
    queryFn: async () => {
      const data = await fetchJson<{
        clients: { id: string; name: string; email: string; clientId: string | null }[];
      }>('/api/admin/clients');
      return data.clients;
    },
    enabled: canCreate,
  });

  const removedClientsQuery = useQuery({
    queryKey: ['admin-removed-clients'],
    queryFn: async () => {
      const data = await fetchJson<{ clients: RemovedClientRow[] }>(
        '/api/admin/clients/removed',
      );
      return data.clients;
    },
    enabled: canCreate,
  });

  const [form, dispatch] = useReducer(formReducer, {
    name: '',
    email: '',
    password: TEMP_PASSWORD,
    role: (isAdmin ? 'manager' : 'intern') as PersonRole,
    reportsToManagerId: '',
    submitting: false,
  } satisfies FormState);

  useEffect(() => {
    if (!createOpen) return;
    dispatch({
      type: 'patch',
      patch: {
        password: TEMP_PASSWORD,
        role: isAdmin ? (form.role === 'client' ? 'intern' : form.role) : 'intern',
      },
    });
    setShowPassword(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset credentials when dialog opens
  }, [createOpen]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    if (!createRoles.includes(form.role as (typeof createRoles)[number])) {
      toastError('You cannot create that role.');
      return;
    }
    if (isAdmin && form.role === 'intern' && !form.reportsToManagerId) {
      toastError('Assign a project manager for this lead.');
      return;
    }
    dispatch({ type: 'patch', patch: { submitting: true } });
    try {
      await fetchJson('/api/admin/people', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email: form.email.trim(),
          password: form.password || TEMP_PASSWORD,
          role: form.role,
          reportsToManagerId:
            form.role === 'intern' && isAdmin ? form.reportsToManagerId || undefined : undefined,
        }),
      });
      toastSuccess(`${ROLE_LABEL[form.role]} created`, form.email);
      dispatch({ type: 'reset' });
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-people'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-managers'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-interns'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-removed-clients'] });
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      dispatch({ type: 'patch', patch: { submitting: false } });
    }
  }

  async function onDelete(person: StaffRow) {
    if (person.id === user?.id) {
      toastError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Delete ${person.name} (${person.email})? This cannot be undone.`)) {
      return;
    }
    setDeletingId(person.id);
    try {
      await fetchJson(`/api/admin/people/${person.id}`, { method: 'DELETE' });
      toastSuccess('Account deleted', person.email);
      await queryClient.invalidateQueries({ queryKey: ['admin-people'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-managers'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-interns'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-removed-clients'] });
      if (selectedManagerId === person.id) {
        router.replace(`${staffBase}/people`);
      }
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  function openChangeEmail(person: StaffRow) {
    setEmailTarget(person);
    setEmailDraft(person.email);
  }

  function closeChangeEmail() {
    setEmailTarget(null);
    setEmailDraft('');
  }

  async function onChangeEmail() {
    if (!emailTarget) return;
    const next = emailDraft.trim().toLowerCase();
    if (!next || !next.includes('@')) {
      toastError('Enter a valid email.');
      return;
    }
    setEmailSaving(true);
    try {
      await fetchJson(`/api/admin/people/${emailTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ email: next }),
      });
      toastSuccess('Email updated', next);
      closeChangeEmail();
      await queryClient.invalidateQueries({ queryKey: ['admin-people'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-managers'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-interns'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-removed-clients'] });
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setEmailSaving(false);
    }
  }

  const people = peopleQuery.data ?? [];
  const admins = people.filter((p) => p.role === 'admin' || p.role === 'super_admin');
  const managers: StaffRow[] = isAdmin
    ? people.filter((p) => p.role === 'manager')
    : [];
  const leads: StaffRow[] = isAdmin
    ? people.filter((p) => p.role === 'intern')
    : (internsQuery.data ?? []).map((m) => ({
        id: m.profileId || m.id,
        name: m.name,
        email: m.email,
        role: 'intern' as const,
        internId: m.id,
        reportsToManagerId: m.reportsToManagerId ?? user?.id ?? null,
      }));
  const clients: StaffRow[] = isAdmin
    ? people.filter((p) => p.role === 'client' && p.status !== 'removed')
    : (clientsQuery.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        role: 'client' as const,
        clientId: c.clientId,
      }));

  const removedClients: RemovedClientRow[] = removedClientsQuery.data ?? [];

  const portfolio = useMemo(() => {
    const active = engagements.filter((e) => e.stage !== 'Operational Readiness');
    const rows = active.map((e) => {
      const reason = deriveStuckReason(e, getStateForEngagement(e));
      return {
        id: e.id,
        slug: e.slug,
        company: e.companyName,
        client: e.clientDisplayName || e.clientEmail || 'Client',
        clientUserId: e.clientUserId,
        stage: e.stage,
        managerId: e.managerId ?? e.adminId,
        leadId: e.internId,
        health: e.health,
        stuck: reason !== 'on_track',
        stuckReason: reason,
      };
    });
    return {
      projectCount: rows.length,
      clientCount: new Set(rows.map((e) => e.clientUserId || e.client)).size,
      rows,
    };
  }, [engagements, getStateForEngagement]);

  const leadName = (id: string | null | undefined) => {
    if (!id) return '—';
    return (
      teamMembers.find((t) => t.id === id)?.name ??
      leads.find((l) => l.internId === id || l.id === id)?.name ??
      id
    );
  };

  const managerName = (id: string | null | undefined) => {
    if (!id) return '—';
    return managers.find((m) => m.id === id)?.name ?? id.slice(0, 8);
  };

  /** True when this project is already attached to the person (as PM or lead). */
  const attachedToPerson = (
    project: (typeof portfolio.rows)[number],
    person: StaffRow,
  ) =>
    person.role === 'manager'
      ? project.managerId === person.id
      : project.leadId === (person.internId ?? person.id);

  const projectsForPerson = (person: StaffRow) =>
    portfolio.rows.filter((c) => attachedToPerson(c, person));

  function openAssign(person: StaffRow) {
    setAssignProjectId(null);
    setAssignTarget(person);
  }

  function closeAssign() {
    setAssignTarget(null);
    setAssignProjectId(null);
  }

  async function onAssignProject() {
    if (!assignTarget || !assignProjectId) return;
    const project = portfolio.rows.find((c) => c.id === assignProjectId);
    setAssigning(true);
    try {
      if (assignTarget.role === 'manager') {
        await updateEngagement(assignProjectId, { managerId: assignTarget.id });
      } else {
        await updateEngagement(assignProjectId, {
          internId: assignTarget.internId ?? assignTarget.id,
        });
      }
      toastSuccess(
        'Project assigned',
        `${project?.company ?? 'Project'} → ${assignTarget.name} (${ROLE_LABEL[assignTarget.role]})`,
      );
      closeAssign();
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setAssigning(false);
    }
  }

  const selectedManager = selectedManagerId
    ? managers.find((m) => m.id === selectedManagerId)
    : null;

  const managerLeads = selectedManagerId
    ? leads.filter((l) => l.reportsToManagerId === selectedManagerId)
    : [];
  const managerProjects = selectedManagerId
    ? portfolio.rows.filter((c) => c.managerId === selectedManagerId)
    : [];

  function openManager(id: string) {
    router.push(`${staffBase}/people?managerId=${id}`);
  }

  function openCreate(role: PersonRole) {
    dispatch({ type: 'patch', patch: { role, password: TEMP_PASSWORD } });
    setCreateOpen(true);
  }

  function PersonRow({
    person,
    meta,
    canManage,
    canAssign,
    onOpen,
  }: {
    person: StaffRow;
    meta?: string;
    canManage: boolean;
    canAssign?: boolean;
    onOpen?: () => void;
  }) {
    const attachedProjects = canAssign ? projectsForPerson(person) : [];
    const showMenu = canManage && person.id !== user?.id;
    return (
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          {onOpen ? (
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md -mx-1 px-1 py-0.5 text-left hover:bg-muted/40"
              onClick={onOpen}
            >
              <div className="text-[13px] font-medium">{person.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{person.email}</div>
              {meta ? <div className="mt-1 text-[11px] text-muted-foreground">{meta}</div> : null}
            </button>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{person.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{person.email}</div>
              {meta ? <div className="mt-1 text-[11px] text-muted-foreground">{meta}</div> : null}
            </div>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {canAssign ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => openAssign(person)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Assign project
              </Button>
            ) : null}
            {showMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
                    aria-label={`Actions for ${person.name}`}
                    disabled={deletingId === person.id}
                  >
                    {deletingId === person.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => openChangeEmail(person)}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Change email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-danger focus:text-danger"
                    onSelect={() => void onDelete(person)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete person
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        {attachedProjects.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {attachedProjects.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={adminProjectPath({ id: p.id, slug: p.slug }, staffBase)}
                className={cn(
                  'inline-flex max-w-48 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] transition-colors hover:border-primary/40 hover:text-foreground',
                  p.stuck ? 'text-warning-text' : 'text-muted-foreground',
                )}
              >
                <Briefcase className="h-2.5 w-2.5 shrink-0" aria-hidden />
                <span className="truncate">{p.company}</span>
              </Link>
            ))}
            {attachedProjects.length > 4 ? (
              <span className="text-[10.5px] text-muted-foreground">
                +{attachedProjects.length - 4} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

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
            <p className="text-[12px] text-muted-foreground">
              Attach a project to{' '}
              <span className="font-medium text-foreground">{assignTarget.name}</span> (
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
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
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
                            ? 'bg-primary-light ring-1 ring-primary/40'
                            : 'hover:bg-muted/40',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{c.company}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          Client {c.client} · PM {managerName(c.managerId)} · Lead{' '}
                          {leadName(c.leadId)} · {c.stage}
                        </div>
                      </div>
                      {attached ? (
                        <span className="mono shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Assigned
                        </span>
                      ) : selected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
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
            <p className="text-[12px] text-muted-foreground">
              Update the sign-in email for{' '}
              <span className="font-medium text-foreground">{emailTarget.name}</span>. They will use
              this address next time they log in.
            </p>
            <div>
              <Label htmlFor="people-change-email" className="text-[12px] text-muted-foreground">
                New email
              </Label>
              <Input
                id="people-change-email"
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="mt-1.5 h-10 font-mono text-[13px]"
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

  if (selectedManagerId && isAdmin) {
    const mgrName = selectedManager?.name ?? 'Project manager';
    const mgrEmail =
      selectedManager && 'email' in selectedManager ? selectedManager.email : '';
    return (
      <PageTransition>
        <SEO
          title={`${mgrName} — People`}
          description="Manager-wise leads, clients, and projects."
          path={`${staffBase}/people`}
        />
        <PageHeader
          accent="violet"
          icon={Users}
          title={mgrName}
          subtitle={mgrEmail || undefined}
          forceBack
          backFallbackHref={`${staffBase}/people`}
          actions={
            selectedManager && selectedManager.id !== user?.id ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={deletingId === selectedManager.id}
                    aria-label="Manager actions"
                  >
                    {deletingId === selectedManager.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    )}
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() =>
                      openChangeEmail({
                        id: selectedManager.id,
                        name: mgrName,
                        email: mgrEmail,
                        role: 'manager',
                      })
                    }
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Change email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-danger focus:text-danger"
                    onSelect={() =>
                      void onDelete({
                        id: selectedManager.id,
                        name: mgrName,
                        email: mgrEmail,
                        role: 'manager',
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete person
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null
          }
        />

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Projects', value: managerProjects.length },
            { label: 'Leads', value: managerLeads.length },
            {
              label: 'Need attention',
              value: managerProjects.filter((p) => p.stuck).length,
            },
          ].map((c) => (
            <Surface key={c.label} className="p-4">
              <Eyebrow>{c.label}</Eyebrow>
              <div className="mt-2 text-2xl font-serif tabular-nums">{c.value}</div>
            </Surface>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Surface className="divide-y divide-border">
            <div className="px-4 py-3">
              <Eyebrow>Project leads</Eyebrow>
            </div>
            {managerLeads.length === 0 ? (
              <EmptyStateIllustrated
                icon={Users}
                title="No leads yet"
                className="m-4 py-8"
              />
            ) : (
              managerLeads.map((l) => (
                <PersonRow
                  key={l.id}
                  person={l}
                  canManage
                />
              ))
            )}
          </Surface>

          <Surface className="divide-y divide-border">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <Eyebrow>Clients & projects</Eyebrow>
              {selectedManager ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => openAssign(selectedManager)}
                >
                  <FolderPlus className="h-3 w-3" />
                  Assign project
                </Button>
              ) : null}
            </div>
            {managerProjects.length === 0 ? (
              <EmptyStateIllustrated
                icon={Briefcase}
                title="No projects assigned"
                className="m-4 py-8"
              />
            ) : (
              managerProjects.map((c) => (
                <Link
                  key={c.id}
                  href={adminProjectPath({ id: c.id, slug: c.slug }, staffBase)}
                  className="block px-4 py-3 hover:bg-muted/40"
                >
                  <div className="truncate text-[13px] font-medium">{c.company}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Client {c.client} · Lead {leadName(c.leadId)} · {c.stage}
                    {c.stuck ? ' · needs attention' : ''}
                  </div>
                </Link>
              ))
            )}
          </Surface>
        </div>
        {assignDialog}
        {emailDialog}
      </PageTransition>
    );
  }

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
          <Surface className="divide-y divide-border">
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
          <Surface className="divide-y divide-border">
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

        <Surface className="divide-y divide-border">
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

        <Surface className="divide-y divide-border">
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

        <Surface className="divide-y divide-border lg:col-span-2">
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
                <div className="font-mono text-[11px] text-muted-foreground">{c.email}</div>
                {c.phone ? (
                  <div className="font-mono text-[11px] text-muted-foreground">{c.phone}</div>
                ) : null}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {c.removedReason ?? 'Removed from their last project'}
                  {c.removedAt ? ` · ${new Date(c.removedAt).toLocaleDateString()}` : ''}
                </div>
              </div>
            ))
          )}
        </Surface>
      </div>

      <Surface className="mt-4 divide-y divide-border">
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
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{c.company}</div>
                <div className="text-[11px] text-muted-foreground">
                  Client {c.client} · PM {managerName(c.managerId)} · Lead {leadName(c.leadId)}
                </div>
              </div>
              <div className="text-[11px] mono uppercase text-muted-foreground">
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
                      ? 'border-primary bg-primary-light text-primary-dark'
                      : 'border-border'
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
