'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, Download } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import type { BulkAction } from '@/components/ui/bulk-bar';
import type { SavedView } from '@/components/ui/saved-views';
import { BulkAssignMenu, RowMoreMenu, RowQuickActions } from '@/components/staff/today/row-actions';
import { clientRemindTargets, type TeamTaskRow } from '@/components/staff/today/today-rows';
import { copyRowLink, exportRowsCsv, reassignMany, remindMany } from '@/components/staff/today/work-actions';
import { ReassignDialog } from '@/views/admin/work/ReassignDialog';
import { toastError } from '@/lib/toast-errors';

/**
 * E-06: the default views of the staff Clients lists (manager Projects, admin Work › Projects and
 * "Clients · where each one is"). `?view=` opens one from a home card tile.
 */
export const CLIENT_LIST_VIEWS: SavedView[] = [
  { key: 'all', label: 'All', filters: {} },
  { key: 'overdue', label: 'My overdue', filters: { show: 'overdue' } },
  { key: 'week', label: 'This week', filters: { show: 'week' } },
  { key: 'waiting', label: 'Waiting on clients', filters: { show: 'waiting' } },
];

/** The next manager-set window end (YYYY-MM-DD) falls within seven days from today. */
export function windowEndsThisWeek(schedule: Engagement['schedule'], now = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const ends = [schedule?.incorporation?.to, ...Object.values(schedule?.steps ?? {}).map((w) => w?.to)].filter(
    (d): d is string => Boolean(d),
  );
  return ends.some((d) => d.slice(0, 10) >= today && d.slice(0, 10) <= end);
}

/**
 * Row selection, the bulk bar (Assign, Remind, Export), the row quick actions (Open, Remind,
 * Reassign), the D1 "..." row menu (Reassign with a side list of leads and a tick on the current
 * one, Copy link with C) and the Reassign dialog for a staff Clients list (E-01, E-02). Assign and
 * Reassign move the whole client from its primary lead (`POST /api/work/reassign`, kind `lead`);
 * Remind sends the client one reminder per item they still owe. There is no Mark done for a client.
 *
 * The admin list assigns managers instead: it passes `assignTo` (the managers and what a pick
 * does) and `onReassignRow` (its assign dialog), and the lead side list leaves the row menu.
 */
export function useClientTableTools<T>({
  rows,
  engagementOf,
  rowKey,
  leads,
  canReassign,
  openHref,
  csv,
  assignTo,
  onReassignRow,
}: {
  rows: T[];
  engagementOf: (row: T) => Engagement;
  rowKey: (row: T) => string;
  leads: Array<{ id: string; name: string }>;
  canReassign: boolean;
  openHref: (row: T) => string;
  csv: { file: string; header: string[]; cells: (row: T) => Array<string | number | null | undefined> };
  /** Bulk Assign to someone other than a lead (the admin list assigns managers). */
  assignTo?: { people: Array<{ id: string; name: string }>; onPick: (list: T[], person: { id: string; name: string }) => Promise<void> | void };
  /** Row Reassign other than the lead dialog (the admin list opens its manager dialog). */
  onReassignRow?: (row: T) => void;
}) {
  const router = useRouter();
  const { requests, getStateForEngagement } = useApp();
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [reassignRow, setReassignRow] = useState<TeamTaskRow | null>(null);

  const sig = rows.map(rowKey).join('|');
  // Rows that leave the list (a filter, a refetch) leave the selection too.
  useEffect(() => {
    setPicked((s) => {
      if (s.size === 0) return s;
      const live = new Set(sig.split('|'));
      const next = new Set([...s].filter((k) => live.has(k)));
      return next.size === s.size ? s : next;
    });
  }, [sig]);

  const targetsOf = (list: T[]) =>
    clientRemindTargets({ engagements: list.map(engagementOf), getState: getStateForEngagement, requests });
  const remind = (list: T[]) => {
    const targets = targetsOf(list);
    if (targets.length === 0) {
      toastError('Nothing to remind', 'These clients owe no step or document right now.');
      return;
    }
    void remindMany(targets);
  };
  const assign = async (list: T[], to: { id: string; name: string }) => {
    const movable = list.map(engagementOf).filter((e) => e.internId && e.internId !== to.id);
    if (movable.length === 0) {
      toastError('Nothing to assign', `These clients have no other lead to move from, or already sit with ${to.name}.`);
      return;
    }
    await reassignMany(
      movable.map((e) => ({ engagementId: e.id, fromLeadId: e.internId, title: e.companyName })),
      to,
    );
    setPicked(new Set());
  };
  const reassignOne = (row: T) => {
    const e = engagementOf(row);
    if (!e.internId) {
      toastError('No lead to move from', 'Assign a lead on the project first.');
      return;
    }
    setReassignRow({
      id: e.id,
      engagementId: e.id,
      companyName: e.companyName,
      title: e.companyName,
      leadId: e.internId,
      leadName: leads.find((l) => l.id === e.internId)?.name ?? 'Project lead',
      area: '',
      status: 'In progress',
      withClient: false,
      href: openHref(row),
    });
  };

  const reassignRowOf = (row: T) => (onReassignRow ? onReassignRow(row) : reassignOne(row));
  const bulkActions = (list: T[]): BulkAction[] => [
    ...(canReassign
      ? [
          {
            key: 'assign',
            label: 'Assign',
            render: (count: number) =>
              assignTo ? (
                <BulkAssignMenu
                  people={assignTo.people}
                  count={count}
                  onPick={(p) => {
                    void Promise.resolve(assignTo.onPick(list, p)).then(() => setPicked(new Set()));
                  }}
                />
              ) : (
                <BulkAssignMenu people={leads} count={count} onPick={(p) => void assign(list, p)} />
              ),
          },
        ]
      : []),
    {
      key: 'remind',
      label: 'Remind',
      icon: BellRing,
      onClick: () => {
        remind(list);
        setPicked(new Set());
      },
    },
    {
      key: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => {
        exportRowsCsv(csv.file, csv.header, list.map(csv.cells));
        setPicked(new Set());
      },
    },
  ];

  return {
    gridProps: {
      selectable: true,
      selected: picked,
      onSelectedChange: setPicked,
      bulkActions,
      bulkNoun: ['client', 'clients'] as [string, string],
      rowActions: (row: T) => {
        const e = engagementOf(row);
        return (
          // The row-actions column is 104px: Open, Remind and the "..." menu, which holds Reassign
          // and Copy link. A on a focused row still opens the Reassign dialog.
          <RowQuickActions onOpen={() => router.push(openHref(row))} onRemind={() => remind([row])}>
            <RowMoreMenu
              reassign={
                !canReassign
                  ? undefined
                  : onReassignRow
                    ? { onOpen: () => onReassignRow(row) }
                    : {
                        people: leads,
                        currentId: e.internId || null,
                        onPick: (p) => {
                          if (p.id === e.internId) return;
                          void assign([row], p);
                        },
                      }
              }
              link={() => void copyRowLink(openHref(row))}
            />
          </RowQuickActions>
        );
      },
      rowShortcuts: [
        { key: 'r', run: (row: T) => remind([row]) },
        ...(canReassign ? [{ key: 'a', run: (row: T) => reassignRowOf(row) }] : []),
        { key: 'c', run: (row: T) => void copyRowLink(openHref(row)) },
      ],
    },
    dialog: canReassign ? (
      <ReassignDialog row={reassignRow} onOpenChange={(open) => (!open ? setReassignRow(null) : undefined)} leads={leads} />
    ) : null,
  };
}
