'use client';

import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SkeletonRows } from '@/components/ui/empty-state';
import { NameCell, PersonAvatar } from '@/components/super/parts/super-parts';
import type { SuperStaff } from '@/components/super/assign/use-super-staff';
import { useEscalations } from '@/components/super/escalations/use-escalations';
import { needsAttention, type SuperEngagementSummary } from '@/lib/super/super-overview';
import { cn } from '@/lib/utils';

/**
 * "Admins" on the super Overview (prototype `adminCols`, G-20): each firm admin with the project
 * managers who report to them (`profiles.reports_to_admin_id`), the clients those managers own,
 * the open steps on them, how many need attention, and the open escalations sent to the admin.
 * Managers with no admin set are grouped in one "No admin" row so nobody drops out of the table.
 */

interface AdminRow {
  id: string;
  name: string;
  managers: string[];
  clients: number;
  open: number;
  attention: number;
  escalations: number;
}

const NO_ADMIN = '__none';

export function SuperAdminsPanel({ staff, engagements }: { staff: SuperStaff; engagements: SuperEngagementSummary[] }) {
  const escalations = useEscalations({ status: 'open' });

  if (staff.isPending) {
    return (
      <DashSection title="Admins">
        <SkeletonRows rows={3} />
      </DashSection>
    );
  }

  const groups = new Map<string, { name: string; managerIds: Set<string>; managers: string[] }>();
  for (const admin of staff.firmAdmins) {
    if (admin.role === 'admin') groups.set(admin.id, { name: admin.name, managerIds: new Set(), managers: [] });
  }
  for (const manager of staff.managers) {
    const admin = staff.adminOfManager.get(manager.id);
    const key = admin?.id ?? NO_ADMIN;
    const group =
      groups.get(key) ??
      { name: admin?.name ?? 'No admin', managerIds: new Set<string>(), managers: [] as string[] };
    group.managerIds.add(manager.id);
    group.managers.push(manager.name);
    groups.set(key, group);
  }

  const openByAdmin = new Map<string, number>();
  for (const e of escalations.data ?? []) {
    if (e.status !== 'open' || !e.assignedToId) continue;
    openByAdmin.set(e.assignedToId, (openByAdmin.get(e.assignedToId) ?? 0) + 1);
  }

  const rows: AdminRow[] = [...groups.entries()].map(([id, group]) => {
    const book = engagements.filter((e) => e.managerId && group.managerIds.has(e.managerId));
    return {
      id,
      name: group.name,
      managers: group.managers,
      clients: book.length,
      open: book.reduce((sum, e) => sum + e.ballInCourt.firm + e.ballInCourt.client, 0),
      attention: book.filter(needsAttention).length,
      escalations: openByAdmin.get(id) ?? 0,
    };
  });
  rows.sort((a, b) => (a.id === NO_ADMIN ? 1 : b.id === NO_ADMIN ? -1 : b.clients - a.clients));

  const columns: EFilingColumn<AdminRow>[] = [
    {
      key: 'name',
      header: 'Admin',
      render: (r) => (
        <NameCell
          lead={<PersonAvatar name={r.name} />}
          title={r.name}
          sub={r.managers.length ? r.managers.join(', ') : 'No managers yet'}
        />
      ),
    },
    { key: 'managers', header: 'Managers', width: '96px', align: 'right', render: (r) => r.managers.length },
    { key: 'clients', header: 'Clients', width: '84px', align: 'right', render: (r) => r.clients },
    { key: 'open', header: 'Open steps', width: '104px', align: 'right', render: (r) => r.open },
    {
      key: 'attention',
      header: 'Attention',
      width: '96px',
      align: 'right',
      render: (r) => <span className={cn(r.attention > 0 && 'font-medium text-danger')}>{r.attention}</span>,
    },
    {
      key: 'esc',
      header: 'Open esc.',
      width: '96px',
      align: 'right',
      render: (r) => <span className={cn(r.escalations > 0 && 'font-medium text-danger')}>{r.id === NO_ADMIN ? '–' : r.escalations}</span>,
    },
  ];

  return (
    <DashSection title="Admins" meta={rows.filter((r) => r.id !== NO_ADMIN).length} href="/app/admin/people" hrefLabel="People" bodyClassName="px-2 pb-2 pt-1">
      <EFilingGrid caption="Admins" columns={columns} rows={rows} rowKey={(r) => r.id} minWidth={680} empty="No admins yet" />
    </DashSection>
  );
}
