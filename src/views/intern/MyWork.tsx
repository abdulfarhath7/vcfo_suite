'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BellRing, CheckCheck, Download, Plus, Sparkles } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { InternWorkBoardCard, InternWorkKindChip } from '@/components/intern/InternWorkRow';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { InternWorkDrawer } from '@/components/intern/InternWorkDrawer';
import { LeadCompanyChip } from '@/components/intern/LeadCompanyChip';
import { FilterChip, FilterChipRow } from '@/components/ui/filter-chip';
import { SavedViews, type SavedView, type ViewFilters } from '@/components/ui/saved-views';
import { StatusMenu } from '@/components/ui/status-menu';
import type { BulkAction } from '@/components/ui/bulk-bar';
import { EFilingGrid, GRID_SUB, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { BulkAssignMenu, RowMoreMenu, RowQuickActions } from '@/components/staff/today/row-actions';
import { PersonCell } from '@/components/staff/today/today-parts';
import { AreaPill } from '@/components/ui/spectrum-chip';
import { ReassignDialog, canMoveItem } from '@/views/admin/work/ReassignDialog';
import type { TeamLead, TeamWorkItem } from '@/views/manager/team-work';
import { workItemChangedAt } from '@/components/staff/today/today-rows';
import {
  TASK_STATUS_WORDS,
  copyRowLink,
  exportRowsCsv,
  remindMany,
  useMarkDoneMany,
  useReassignMany,
  useSetTaskStatus,
} from '@/components/staff/today/work-actions';
import { internKindStatus } from '@/components/intern/intern-tones';
import { remindableItemKey } from '@/lib/reminders/reminder-rules';
import type { StatusCode } from '@/data/checklist';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Tag } from '@/components/ui/spectrum-chip';
import { Button } from '@/components/ui/button';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import { useFilings } from '@/hooks/use-filings';
import { useOwnFocusTodos } from '@/hooks/use-personal-todos';
import { useApp } from '@/context/AppContext';
import { PlannerCalendar, type PlannerItem } from '@/components/work/PlannerCalendar';
import { PlanWeekDialog } from '@/components/work/PlanWeekDialog';
import { NewTodoDialog, PlannerTodos } from '@/components/work/PlannerTodos';
import { RunningSessionChip } from '@/components/work/RunningSessionChip';
import { filingInstanceIdMap, workItemKeyFor } from '@/lib/work/work-item-key';
import { addDaysYmd, istYmdOf, weekOf } from '@/lib/work/planner';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import {
  INTERN_TASKS_PATH,
  INTERN_WORK_VIEW_KEY,
  createCustomInternFocus,
  filterInternWork,
  formatDueLabel,
  formatIstWeekdayDay,
  internTimelineGantt,
  internWorkBoard,
  internWorkPath,
  parseInternWorkDay,
  parseInternWorkFocus,
  parseInternWorkKindFilter,
  parseInternWorkTag,
  parseInternWorkView,
  sortInternWork,
  ymdInIst,
  type InternWorkFocus,
  type InternWorkItem,
  type InternWorkKindFilter,
  type InternWorkKpis,
  type InternWorkTag,
  type InternWorkView,
} from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

/** The three list views plus the Planner (G-17), which lives only in this view's URL. */
export type WorkView = InternWorkView | 'plan';

const VIEWS: { key: WorkView; label: string }[] = [
  { key: 'list', label: 'List' },
  { key: 'board', label: 'Board' },
  { key: 'tl', label: 'Timeline' },
  { key: 'plan', label: 'Planner' },
];

function parseWorkView(value: string | null | undefined): WorkView {
  return value === 'plan' ? 'plan' : parseInternWorkView(value);
}

/**
 * `internWorkPath` with the Planner view kept in the `view` param, on the page at `path` (the
 * lead's `/app/intern/tasks`, the manager's `/app/manager/work`, or one lead's page). `lead`
 * is the team pages' Lead filter.
 */
function workPath(
  filters: Parameters<typeof internWorkPath>[0] & { lead?: string | null },
  view: WorkView,
  path: string = INTERN_TASKS_PATH,
  extra?: Record<string, string>,
): string {
  const url = new URL(internWorkPath({ ...filters, view: view === 'plan' ? 'tl' : view }), 'http://work.local');
  if (view === 'plan') url.searchParams.set('view', 'plan');
  if (filters.lead) url.searchParams.set('lead', filters.lead);
  for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
  return `${path}${url.search}`;
}

/** Open items the planner may place: everything not done and not waiting on someone else. */
const PLANNABLE = new Set(['rejected', 'review', 'deliver', 'overdue', 'in-progress', 'filing', 'task']);

const FOCUS_OPTIONS: { value: InternWorkFocus; label: string }[] = [
  { value: 'action', label: 'Needs action' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'due', label: 'Due this week' },
  { value: 'progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

/**
 * E-06: the default saved views of Work. A view is a set of the URL filters below; the lead's
 * home card tiles open them with `?view=overdue`, `?view=week` and `?view=waiting`.
 */
const WORK_VIEWS: SavedView[] = [
  { key: 'all', label: 'All', filters: {} },
  { key: 'overdue', label: 'My overdue', filters: { focus: 'overdue' } },
  { key: 'week', label: 'This week', filters: { focus: 'due' } },
  { key: 'waiting', label: 'Waiting on clients', filters: { tag: 'client' } },
];

const TAG_LABEL: Record<InternWorkTag, string> = {
  rejected: 'Sent back',
  review: 'Review',
  deliver: 'Deliver',
  critical: 'Critical',
  overdue: 'Overdue',
  client: 'With client',
  manager: 'With manager',
  filings: 'Filings',
  steps: 'Steps',
};

/**
 * Lead Work (prototype `WorkScreen`): list, board and timeline of the lead's open steps and
 * filings. The views sit in a segmented switch; the filters are R-10 chips in the table head
 * bar and still live in the URL, so links from Today keep working. A row opens the task drawer
 * with the item's facts and its action; the step page stays one click away. The Planner view
 * holds the week calendar of time blocks and the personal to-dos; "Plan my week" and
 * "New to-do" sit in the head on every view (G-17).
 */
function InternMyWorkInner() {
  const { workItems, kpis, myEngagements } = useInternPortfolio();
  return <WorkScreen workItems={workItems} kpis={kpis} engagements={myEngagements} />;
}

/** The team part of a Work page: the leads, and each item's lead (manager Work, one lead's page). */
export interface WorkTeam {
  /** Leads the items can move to (`/api/work/reassign`); empty hides Assign and Reassign. */
  leads: TeamLead[];
  /** The team item for a work item id, with its lead and the Reassign row. */
  byId: Map<string, TeamWorkItem>;
  /** Show the Lead column, the Lead filter and the lead on board cards (the manager's Work). */
  showLead: boolean;
  /** The lead key of the viewer's own tasks: those items, and items waiting on a manager, are "Pending with me". */
  meKey?: string;
}

export interface WorkScreenProps {
  workItems: InternWorkItem[];
  kpis: InternWorkKpis;
  /** The engagements behind the items, for the Company filter. */
  engagements: Engagement[];
  /** The page the filters live on; the lead's Work by default. */
  path?: string;
  /** A page head in place of the "Work" title and its buttons (the one-lead page); `false` for none (a tab of another page). */
  head?: ReactNode | false;
  /** URL params of the host page kept on every filter change (`tab=leads` on the admin Work page). */
  extraParams?: Record<string, string>;
  /** Cards between the head and the views (the one-lead page's Status and By area). */
  summary?: ReactNode;
  /** The views offered, in order; all four by default. */
  views?: WorkView[];
  /** The Planner view's content in place of the user's own calendar and to-dos. */
  planner?: ReactNode;
  team?: WorkTeam;
  /** Where the table preferences and the saved views are kept. */
  storageScope?: string;
  seo?: { title: string; description: string; path: string };
}

/**
 * Work: the lead's own Work page (`/app/intern/tasks`), the manager's Work (`/app/manager/work`)
 * and the work part of one lead's page. With `team` the list adds the Lead column and filter,
 * bulk Assign and row Reassign (managers and admins move steps and tasks through
 * `/api/work/reassign`), the board shows each card's lead and the drawer marks items that wait
 * on the viewer.
 */
export function WorkScreen({
  workItems,
  kpis,
  engagements: myEngagements,
  path = INTERN_TASKS_PATH,
  head,
  extraParams,
  summary,
  views: allowedViews,
  planner,
  team,
  storageScope,
  seo = { title: 'My work — VCFO Suite', description: 'List, board, and timeline of your open steps and filings.', path: '/app/intern/tasks' },
}: WorkScreenProps) {
  const params = useSearchParams();
  const router = useRouter();
  const { user, tasks, engagementsLoading, getStateForEngagement } = useApp();
  const viewList = allowedViews ? VIEWS.filter((v) => allowedViews.includes(v.key)) : VIEWS;
  const scopeKey = storageScope ?? user?.id ?? 'lead';
  const register = useFilings();
  const { focus: todos, persist: persistTodos, byId: todoItems } = useOwnFocusTodos(user?.id ?? '', workItems);
  const now = useMemo(() => new Date(), []);
  const focus = parseInternWorkFocus(params.get('focus'));
  const tag = parseInternWorkTag(params.get('tag'));
  const companyId = params.get('company');
  const kind = parseInternWorkKindFilter(params.get('kind'));
  const day = parseInternWorkDay(params.get('day'));
  const leadFilter = team?.showLead ? params.get('lead') : null;
  const fitView = (v: WorkView): WorkView => (viewList.some((x) => x.key === v) ? v : viewList[0]!.key);
  const [view, setView] = useState<WorkView>(() => fitView(parseWorkView(params.get('view'))));
  const listRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [weekYmd, setWeekYmd] = useState(() => istYmdOf(now));
  const [planOpen, setPlanOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [moving, setMoving] = useState<InternWorkItem | null>(null);
  const reassign = useReassignMany();

  const viewKey = path === INTERN_TASKS_PATH ? INTERN_WORK_VIEW_KEY : `${INTERN_WORK_VIEW_KEY}:${path}`;
  useEffect(() => {
    const fromUrl = params.get('view');
    if (fromUrl) {
      setView(fitView(parseWorkView(fromUrl)));
      return;
    }
    try {
      const stored = window.localStorage.getItem(viewKey);
      if (stored) setView(fitView(parseWorkView(stored)));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fitView` and `viewKey` follow the props that do not change on a page.
  }, [params]);

  const filtered = useMemo(
    () =>
      sortInternWork(
        filterInternWork(workItems, { focus, tag, companyId, kind, day }, now).filter(
          (item) => !leadFilter || team?.byId.get(item.id)?.leadId === leadFilter,
        ),
      ),
    [workItems, focus, tag, companyId, kind, day, now, leadFilter, team],
  );
  const openItem = openId ? workItems.find((item) => item.id === openId) ?? null : null;

  // Stored item keys (sessions, checklist, blocks, date requests) for each Work row.
  const filingIds = useMemo(() => filingInstanceIdMap(register.data?.rows ?? []), [register.data]);
  const keyOf = useMemo(() => {
    const out = new Map<string, string>();
    for (const item of workItems) {
      const key = workItemKeyFor(item, filingIds);
      if (key) out.set(item.id, key);
    }
    return out;
  }, [workItems, filingIds]);
  const idOfKey = useMemo(() => new Map([...keyOf.entries()].map(([id, key]) => [key, id])), [keyOf]);
  const openByKey = (key: string) => {
    const id = idOfKey.get(key);
    if (id) setOpenId(id);
  };

  const weekDays = useMemo(() => weekOf(weekYmd), [weekYmd]);
  const plannerItems = useMemo<PlannerItem[]>(
    () =>
      filtered
        .filter((item) => PLANNABLE.has(item.kind) && keyOf.has(item.id))
        .map((item) => ({
          key: keyOf.get(item.id)!,
          title: item.title,
          companyName: item.companyName,
          dueYmd: item.dueAt?.slice(0, 10),
          overdue: item.isOverdue,
        })),
    [filtered, keyOf],
  );
  const stepWeek = (delta: -1 | 0 | 1) => setWeekYmd((ymd) => (delta === 0 ? istYmdOf(new Date()) : addDaysYmd(ymd, delta * 7)));

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of myEngagements) seen.set(e.id, e.companyName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
  }, [myEngagements]);

  const go = (next: {
    focus?: InternWorkFocus;
    tag?: InternWorkTag | null;
    companyId?: string | null;
    kind?: InternWorkKindFilter;
    view?: WorkView;
    day?: string | null;
    lead?: string | null;
  }) => {
    const href = workPath(
      {
        focus: next.focus ?? focus,
        tag: next.tag === undefined ? tag : next.tag,
        companyId: next.companyId === undefined ? companyId : next.companyId,
        kind: next.kind ?? kind,
        day: next.day === undefined ? day : next.day,
        lead: next.lead === undefined ? leadFilter : next.lead,
      },
      next.view ?? view,
      path,
      extraParams,
    );
    router.replace(href, { scroll: false });
  };

  const chooseView = (next: WorkView) => {
    setView(next);
    try {
      window.localStorage.setItem(viewKey, next);
    } catch {
      /* ignore */
    }
    go({ view: next });
  };

  // J and K move the focus through the list rows; Enter on a focused row opens the drawer.
  useEffect(() => {
    if (view !== 'list' || openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== 'j' && e.key !== 'J' && e.key !== 'k' && e.key !== 'K') return;
      const rows = [...(listRef.current?.querySelectorAll<HTMLTableRowElement>('tbody tr[tabindex]') ?? [])];
      if (rows.length === 0) return;
      const at = rows.findIndex((r) => r === document.activeElement);
      const next = e.key === 'j' || e.key === 'J' ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0);
      e.preventDefault();
      rows[next]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, openId]);

  // E-05: a home card tile opens Work on one saved view (`?view=overdue`). The view's filters
  // become the URL filters, on the list.
  const viewParam = params.get('view');
  useEffect(() => {
    const saved = WORK_VIEWS.find((v) => v.key === viewParam);
    if (!saved) return;
    router.replace(workPath(filtersOfView(saved.filters), 'list', path, extraParams), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `extraParams` is fixed for a page.
  }, [viewParam, router, path]);

  const anyFilter = Boolean(companyId || kind !== 'all' || focus !== 'all' || tag || day || leadFilter);
  const clearAll = () =>
    router.replace(workPath({ focus: 'all', tag: null, companyId: null, kind: 'all', day: null, lead: null }, view, path, extraParams), {
      scroll: false,
    });
  const currentView: ViewFilters = {
    focus: focus === 'all' ? '' : focus,
    tag: tag ?? '',
    company: companyId ?? '',
    kind: kind === 'all' ? '' : kind,
    day: day ?? '',
    ...(team?.showLead ? { lead: leadFilter ?? '' } : {}),
  };
  const applyView = (f: ViewFilters) => router.replace(workPath(filtersOfView(f), view, path, extraParams), { scroll: false });
  const leadOptions = useMemo(() => {
    if (!team?.showLead) return [];
    const seen = new Map<string, string>();
    for (const t of team.byId.values()) seen.set(t.leadId, t.leadName);
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [team]);
  const filters = (
    <FilterChipRow
      className="min-w-0 flex-1"
      onClear={anyFilter ? clearAll : undefined}
      chips={[
        {
          key: 'company',
          set: !!companyId,
          node: (
            <FilterChip
              label="Company"
              value={companyId ?? ''}
              options={companies.map(([id, name]) => ({ value: id, label: name }))}
              onChange={(v) => go({ companyId: v || null })}
            />
          ),
        },
        ...(team?.showLead
          ? [
              {
                key: 'lead',
                set: !!leadFilter,
                node: (
                  <FilterChip label="Lead" value={leadFilter ?? ''} options={leadOptions} onChange={(v) => go({ lead: v || null })} />
                ),
              },
            ]
          : []),
        {
          key: 'status',
          set: focus !== 'all',
          node: (
            <FilterChip
              label="Status"
              value={focus === 'all' ? '' : focus}
              options={FOCUS_OPTIONS}
              onChange={(v) => go({ focus: (v || 'all') as InternWorkFocus })}
            />
          ),
        },
        {
          key: 'show',
          set: kind !== 'all',
          node: (
            <FilterChip
              label="Show"
              value={kind === 'all' ? '' : kind}
              options={[
                { value: 'steps', label: 'Steps only' },
                { value: 'filings', label: 'Filings only' },
              ]}
              onChange={(v) => go({ kind: (v || 'all') as InternWorkKindFilter })}
            />
          ),
        },
        ...(tag
          ? [{ key: 'tag', set: true, node: <FilterChip label="Tag" value={tag} valueLabel={TAG_LABEL[tag]} options={[]} onChange={() => go({ tag: null })} /> }]
          : []),
        ...(day
          ? [
              {
                key: 'day',
                set: true,
                node: <FilterChip label="Day" value={day} valueLabel={formatIstWeekdayDay(day).label} options={[]} onChange={() => go({ day: null })} />,
              },
            ]
          : []),
      ]}
    />
  );
  const savedViews = (
    <SavedViews storageKey={`${scopeKey}:work`} views={WORK_VIEWS} current={currentView} onApply={applyView} className="mb-3" />
  );

  // Table parts for the list (E-01 to E-09).
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const engById = useMemo(() => new Map(myEngagements.map((e) => [e.id, e])), [myEngagements]);
  const changedAt = (item: InternWorkItem) => {
    const eng = engById.get(item.engagementId);
    const slice = eng && item.catalogId ? getStateForEngagement(eng)[item.catalogId] : undefined;
    return workItemChangedAt(item, slice, item.taskId ? taskById.get(item.taskId)?.updatedAt : undefined);
  };
  const taskStatusOf = (item: InternWorkItem): StatusCode | undefined => (item.taskId ? taskById.get(item.taskId)?.status : undefined);
  // A filing's real compliance instance id comes from the register row (its stored item key).
  const filingInstanceOf = (item: InternWorkItem): string | undefined => {
    const key = item.source === 'filing' ? keyOf.get(item.id) : undefined;
    return key?.startsWith('filing:') ? key.slice('filing:'.length) : undefined;
  };

  return (
    <PageTransition>
      <SEO title={seo.title} description={seo.description} path={seo.path} />

      {head === undefined ? (
      <div className="mb-5 flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-[1_1_240px]">
          <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Work</h1>
          <p className="text-[13.5px] text-ink-muted tabular-nums">
            {kpis.openCount} open · {kpis.companyCount} {kpis.companyCount === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <RunningSessionChip
          titleFor={(key) => workItems.find((item) => item.id === idOfKey.get(key))?.title ?? null}
          onOpen={openByKey}
        />
        <SpectrumTabs
          size="md"
          label="Work view"
          items={viewList}
          value={view}
          onChange={(next) => chooseView(next as WorkView)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (view !== 'plan') chooseView('plan');
              setPlanOpen(true);
            }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.6} /> Plan my week
          </Button>
          <Button onClick={() => setTodoOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.6} /> New to-do
          </Button>
        </div>
      </div>
      ) : head}

      {head !== undefined ? (
        <SpectrumTabs
          size="md"
          label="Work view"
          items={viewList}
          value={view}
          onChange={(next) => chooseView(next as WorkView)}
          className="mb-3"
        />
      ) : null}
      {summary}
      {savedViews}

      {view === 'list' ? (
        <WorkCard filters={filters} meta={`${filtered.filter((i) => i.kind !== 'done').length} open`}>
          <div ref={listRef}>
            <ListView
              items={filtered}
              now={now}
              onOpen={(item) => setOpenId(item.id)}
              scope={scopeKey}
              team={team}
              onReassign={setMoving}
              loading={engagementsLoading}
              onClearFilters={anyFilter ? clearAll : undefined}
              changedAt={changedAt}
              taskStatusOf={taskStatusOf}
              filingInstanceOf={filingInstanceOf}
            />
          </div>
        </WorkCard>
      ) : null}
      {view === 'board' ? (
        <>
          <div className="mb-3 flex min-h-[44px] flex-wrap items-center gap-2">{filters}</div>
          <BoardView items={filtered} now={now} onOpen={(item) => setOpenId(item.id)} ownerOf={team?.showLead ? (i) => team.byId.get(i.id)?.leadName : undefined} />
        </>
      ) : null}
      {view === 'tl' ? (
        <TimelineView items={filtered} now={now} selectedDay={day} filters={filters} onOpen={(item) => setOpenId(item.id)} />
      ) : null}

      {view === 'plan' && planner ? planner : null}
      {view === 'plan' && !planner ? (
        <>
          <div className="mb-3 flex min-h-[44px] flex-wrap items-center gap-2">{filters}</div>
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <PlannerCalendar days={weekDays} onWeek={stepWeek} items={plannerItems} now={now} onOpenItem={openByKey} />
            <PlannerTodos
              focus={todos}
              byId={todoItems}
              persist={persistTodos}
              onOpenItem={setOpenId}
              onNew={() => setTodoOpen(true)}
              hand={
                team && team.leads.length > 0
                  ? {
                      leads: team.leads,
                      ownerOf: (i) => {
                        const t = team.byId.get(i.id);
                        return t ? { id: t.leadId, name: t.leadName } : undefined;
                      },
                      canHand: (i) => {
                        const t = team.byId.get(i.id);
                        return Boolean(t && canMoveItem(t.row));
                      },
                      onHand: (i, to) => {
                        const t = team.byId.get(i.id);
                        if (!t?.row.itemId) return;
                        void reassign([{ engagementId: t.engagementId, itemKey: t.row.itemId, title: t.title }], to);
                      },
                    }
                  : undefined
              }
            />
          </div>
        </>
      ) : null}

      <InternWorkDrawer
        item={openItem}
        workKey={openItem ? keyOf.get(openItem.id) ?? null : null}
        now={now}
        onClose={() => setOpenId(null)}
        ownerName={openItem && team ? team.byId.get(openItem.id)?.leadName : undefined}
        pendingWithMe={Boolean(
          team?.meKey && openItem && (openItem.kind === 'waiting-manager' || team.byId.get(openItem.id)?.leadId === team.meKey),
        )}
      />
      {team ? (
        <ReassignDialog row={moving ? team.byId.get(moving.id)?.row ?? null : null} onOpenChange={(o) => !o && setMoving(null)} leads={team.leads} />
      ) : null}
      <PlanWeekDialog open={planOpen} onOpenChange={setPlanOpen} days={weekDays} items={plannerItems} now={now} />
      <NewTodoDialog
        open={todoOpen}
        onOpenChange={setTodoOpen}
        onAdd={(title) => {
          persistTodos([createCustomInternFocus(title), ...todos]);
          if (view !== 'plan') chooseView('plan');
          toastSuccess('To-do added', title);
        }}
      />
    </PageTransition>
  );
}

/** A card whose head bar holds the filter chips (R-08, R-10) and a small count. */
function WorkCard({
  filters,
  meta,
  right,
  children,
}: {
  filters: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-2">
        {filters}
        {right}
        {meta ? <span className="shrink-0 text-[12.5px] text-ink-muted tabular-nums">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A saved view's filters as the Work URL filters (missing keys clear the filter). */
function filtersOfView(f: ViewFilters) {
  return {
    focus: parseInternWorkFocus(f.focus),
    tag: parseInternWorkTag(f.tag ?? null),
    companyId: f.company || null,
    kind: parseInternWorkKindFilter(f.kind),
    day: f.day || null,
    lead: f.lead || null,
  };
}

/**
 * List view: T1 clean rows (R-07) on the shared grid. J and K move the focus; Enter opens the
 * drawer. With `scope` the list gets row selection and the bulk bar (Remind, Mark done, Export),
 * Open and Remind at the row end on hover and focus (R reminds), the row menu with Edit (E) and
 * Copy link (C) (M-27), the status menu on task rows, the density switch, the sticky head and
 * the new-since-last-visit squares. A lead cannot move work to another lead
 * (`/api/work/reassign` is for managers and admins), so Assign and Reassign come only with
 * `team`: bulk Assign, the Reassign row action (A) and the Lead and Area columns. A late row
 * gets the soft red fill.
 */
function ListView({
  items,
  now,
  onOpen,
  scope,
  team,
  onReassign,
  loading,
  onClearFilters,
  changedAt,
  taskStatusOf,
  filingInstanceOf,
}: {
  items: InternWorkItem[];
  now: Date;
  onOpen: (item: InternWorkItem) => void;
  /** The user id for the table preferences; without it the list is read-only. */
  scope?: string;
  team?: WorkTeam;
  onReassign?: (item: InternWorkItem) => void;
  loading?: boolean;
  onClearFilters?: () => void;
  changedAt?: (item: InternWorkItem) => string | undefined;
  taskStatusOf?: (item: InternWorkItem) => StatusCode | undefined;
  /** The filing's `compliance_instances.id`, when the register has it; Mark done files it. */
  filingInstanceOf?: (item: InternWorkItem) => string | undefined;
}) {
  const router = useRouter();
  const markDone = useMarkDoneMany();
  const setTaskStatus = useSetTaskStatus();
  const reassignMany = useReassignMany();
  const teamOf = (i: InternWorkItem) => team?.byId.get(i.id);
  const canReassign = Boolean(team && team.leads.length > 0 && onReassign);
  // M-27 Edit: a task opens its drawer; a step, filing or request opens the record it is edited on.
  const edit = (i: InternWorkItem) => (i.source === 'task' ? onOpen(i) : router.push(i.href));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const sig = items.map((i) => i.id).join('|');
  useEffect(() => {
    setPicked((s) => {
      if (s.size === 0) return s;
      const live = new Set(sig.split('|'));
      const next = new Set([...s].filter((k) => live.has(k)));
      return next.size === s.size ? s : next;
    });
  }, [sig]);

  const remind = (list: InternWorkItem[]) => {
    const targets = list
      .map((i) => ({ i, key: remindableItemKey(i) }))
      .filter((x): x is { i: InternWorkItem; key: string } => Boolean(x.key))
      .map(({ i, key }) => ({ engagementId: i.engagementId, itemKey: key, title: i.title }));
    if (targets.length > 0) void remindMany(targets);
  };

  const statusCell = (item: InternWorkItem) => {
    const chip = <InternWorkKindChip item={item} />;
    // E-03 only where a status write exists: a task (PATCH /api/tasks/:id).
    if (!scope || item.source !== 'task' || !item.taskId) return chip;
    return (
      <StatusMenu
        value={internKindStatus(item).word}
        words={TASK_STATUS_WORDS}
        label={`${item.title} · ${item.companyName}`}
        onChange={(w) => setTaskStatus(item.taskId!, w, taskStatusOf?.(item), item.title)}
      >
        {chip}
      </StatusMenu>
    );
  };

  const columns: EFilingColumn<InternWorkItem>[] = [
    {
      key: 'title',
      header: 'Step or filing',
      render: (item) => (
        <span className="flex min-w-0 flex-col">
          <span
            title={item.title}
            className={cn('truncate font-medium text-ink', item.kind === 'done' && 'text-ink-muted line-through')}
          >
            {item.title}
          </span>
          <span className={cn('truncate text-[12px] text-ink-muted md:hidden', GRID_SUB)}>{item.companyName}</span>
        </span>
      ),
    },
    {
      key: 'company',
      header: 'Client',
      width: '22%',
      render: (item) => <LeadCompanyChip name={item.companyName} engagementId={item.engagementId} />,
    },
    {
      key: 'step',
      header: 'Step',
      width: '84px',
      render: (item) =>
        item.catalogLabel ? (
          <span className="font-mono text-[12.5px] text-ink-2">{item.catalogLabel}</span>
        ) : (
          <span className="text-[12.5px] text-ink-muted">{item.source === 'filing' ? 'Filing' : item.source === 'request' ? 'Request' : 'Task'}</span>
        ),
    },
    ...(team
      ? [
          {
            key: 'area',
            header: 'Area',
            width: '120px',
            render: (item: InternWorkItem) => {
              const area = teamOf(item)?.area;
              return area ? <AreaPill area={area} /> : null;
            },
          },
        ]
      : []),
    ...(team?.showLead
      ? [
          {
            key: 'lead',
            header: 'Lead',
            width: '132px',
            render: (item: InternWorkItem) => {
              const name = teamOf(item)?.leadName;
              return name ? <PersonCell name={name} /> : null;
            },
          },
        ]
      : []),
    {
      key: 'due',
      header: 'Due',
      width: '84px',
      render: (item) => (
        <span className={cn('tabular-nums', item.isOverdue && item.kind !== 'done' && 'font-medium text-danger')}>
          {formatDueLabel(item.dueAt, now)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: '128px', render: statusCell },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      width: '136px',
      align: 'right',
      render: (item) => (
        <span data-grid-ctl className="inline-flex">
          <InternWorkCtaButton item={item} />
        </span>
      ),
    },
  ];

  const assign = async (list: InternWorkItem[], to: { id: string; name: string }) => {
    const movable = list
      .map((i) => teamOf(i))
      .filter((t): t is TeamWorkItem => Boolean(t && canMoveItem(t.row) && t.leadId !== to.id));
    if (movable.length === 0) {
      toastError('Nothing to assign', 'Steps and tasks move one at a time; filings and requests move with the client.');
      return;
    }
    await reassignMany(movable.map((t) => ({ engagementId: t.engagementId, itemKey: t.row.itemId, title: t.title })), to);
    setPicked(new Set());
  };

  const bulkActions = (list: InternWorkItem[]): BulkAction[] => [
    ...(canReassign && team
      ? [
          {
            key: 'assign',
            label: 'Assign',
            render: (count: number) => <BulkAssignMenu people={team.leads} count={count} onPick={(p) => void assign(list, p)} />,
          },
        ]
      : []),
    {
      key: 'remind',
      label: 'Remind',
      icon: BellRing,
      disabled: !list.some((i) => remindableItemKey(i)),
      onClick: () => {
        remind(list);
        setPicked(new Set());
      },
    },
    {
      key: 'done',
      label: 'Mark done',
      icon: CheckCheck,
      disabled: list.every((i) => i.kind === 'done'),
      onClick: () => {
        void markDone(list.map((i) => ({ ...i, done: i.kind === 'done', filingInstanceId: filingInstanceOf?.(i) })));
        setPicked(new Set());
      },
    },
    {
      key: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => {
        exportRowsCsv(
          'work.csv',
          ['Step or filing', 'Client', ...(team ? ['Lead'] : []), 'Status', 'Due', 'State'],
          list.map((i) => [
            i.title,
            i.companyName,
            ...(team ? [teamOf(i)?.leadName ?? ''] : []),
            internKindStatus(i).word,
            i.dueAt?.slice(0, 10) ?? '',
            i.why,
          ]),
        );
        setPicked(new Set());
      },
    },
  ];

  return (
    <div className="px-2 pb-2">
      <EFilingGrid
        caption="Work"
        columns={columns}
        rows={items}
        rowKey={(i) => i.id}
        onRowClick={onOpen}
        rowClassName={(i) => (i.isOverdue && i.kind !== 'done' ? 'bg-danger-soft/40' : undefined)}
        pageSize={25}
        minWidth={team ? 960 : 800}
        empty="Nothing in this view"
        loading={loading}
        onClearFilters={onClearFilters}
        stickyHead
        stickyFirstColumn
        {...(scope
          ? {
              selectable: true,
              selected: picked,
              onSelectedChange: setPicked,
              bulkActions,
              bulkNoun: ['item', 'items'] as [string, string],
              rowActions: (i: InternWorkItem) => (
                <RowQuickActions
                  onOpen={() => onOpen(i)}
                  onRemind={remindableItemKey(i) ? () => remind([i]) : undefined}
                  onReassign={canReassign && teamOf(i) ? () => onReassign?.(i) : undefined}
                >
                  <RowMoreMenu onEdit={() => edit(i)} link={() => void copyRowLink(i.href)} />
                </RowQuickActions>
              ),
              rowShortcuts: [
                { key: 'r', run: (i: InternWorkItem) => remind([i]) },
                { key: 'e', run: edit },
                { key: 'c', run: (i: InternWorkItem) => void copyRowLink(i.href) },
                ...(canReassign ? [{ key: 'a', run: (i: InternWorkItem) => (teamOf(i) ? onReassign?.(i) : undefined) }] : []),
              ],
              densityScope: `${scope}:work`,
              changedAt,
              visitKey: `${scope}:work`,
            }
          : {})}
      />
    </div>
  );
}

const BOARD_COLS: { key: 'action' | 'progress' | 'waiting' | 'done'; label: string; tone: 'warn' | 'prog' | 'teal' | 'ok' }[] = [
  { key: 'action', label: 'Needs action', tone: 'warn' },
  { key: 'progress', label: 'In progress', tone: 'prog' },
  { key: 'waiting', label: 'Waiting', tone: 'teal' },
  { key: 'done', label: 'Done this week', tone: 'ok' },
];

/** Board view (prototype `WorkBoard`): four quiet columns with a count tag in each head. */
function BoardView({
  items,
  now,
  onOpen,
  ownerOf,
}: {
  items: InternWorkItem[];
  now: Date;
  onOpen: (item: InternWorkItem) => void;
  /** The lead on each card (manager Work). */
  ownerOf?: (item: InternWorkItem) => string | undefined;
}) {
  const cols = internWorkBoard(items, now);
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BOARD_COLS.map((col) => (
        <section
          key={col.key}
          data-col={col.key}
          aria-label={col.label}
          className="min-w-0 rounded-md border-1.5 border-line bg-surface-sunken"
        >
          <header className="flex h-11 items-center gap-2 border-b border-line-soft px-4">
            <h2 className="text-[14px] font-medium text-ink">{col.label}</h2>
            <Tag tone={col.tone}>{cols[col.key].length}</Tag>
          </header>
          <div className="grid gap-2 p-3">
            {cols[col.key].length === 0 ? <EmptyWork className="min-h-[72px] py-4" /> : null}
            {cols[col.key].map((item) => (
              <InternWorkBoardCard key={item.id} item={item} now={now} dim={col.key === 'done'} onOpen={onOpen} owner={ownerOf?.(item)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const BAR_TONE = {
  overdue: 'bg-danger-mid text-white',
  soon: 'border-1.5 border-warning-mid bg-warning-soft text-warning',
  ok: 'hatch text-brand-text',
  done: 'bg-positive-mid text-white',
} as const;

const TIMELINE_LEGEND: Array<[string, string]> = [
  ['On track', 'hatch'],
  ['Due soon', 'border-1.5 border-warning-mid bg-warning-soft'],
  ['Overdue', 'bg-danger-mid'],
  ['Done', 'bg-positive-mid'],
];

/**
 * Timeline view (R-21): a 14-day Gantt with 16px bars, 3px corners and the orange today line.
 * An on-track bar shows the part up to today solid and the rest as blurple hatch.
 */
function TimelineView({
  items,
  now,
  selectedDay,
  filters,
  onOpen,
}: {
  items: InternWorkItem[];
  now: Date;
  selectedDay: string | null;
  filters: ReactNode;
  onOpen: (item: InternWorkItem) => void;
}) {
  const today = ymdInIst(now);
  const gantt = internTimelineGantt(items, now);
  const todayIdx = gantt.window.indexOf(today);
  const groups: { id: string; name: string; rows: typeof gantt.rows }[] = [];
  for (const row of gantt.rows) {
    let g = groups.find((x) => x.id === row.item.engagementId);
    if (!g) {
      g = { id: row.item.engagementId, name: row.item.companyName, rows: [] };
      groups.push(g);
    }
    g.rows.push(row);
  }
  const grid = { gridTemplateColumns: `minmax(150px,220px) repeat(${gantt.window.length}, minmax(30px, 1fr))` };
  const legend = (
    <span className="hidden flex-wrap items-center gap-3 text-[12px] text-ink-muted xl:flex">
      {TIMELINE_LEGEND.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1.5">
          <i className={cn('h-2.5 w-3.5 rounded-bar', cls)} aria-hidden />
          {label}
        </span>
      ))}
    </span>
  );
  const first = gantt.window[0];
  const last = gantt.window[gantt.window.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <WorkCard
        filters={filters}
        right={legend}
        meta={first && last ? `${formatDueLabel(`${first}T12:00:00+05:30`, now)} to ${formatDueLabel(`${last}T12:00:00+05:30`, now)}` : undefined}
      >
        {gantt.rows.length === 0 && gantt.later.length === 0 ? (
          <EmptyWork className="m-4" />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid h-9 items-center border-b-1.5 border-line text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted" style={grid}>
                <span className="px-4">Task</span>
                {gantt.window.map((ymd) => {
                  const heading = formatIstWeekdayDay(ymd);
                  const isToday = ymd === today;
                  const weekend = heading.weekday === 'Sat' || heading.weekday === 'Sun';
                  return (
                    <span
                      key={ymd}
                      id={selectedDay === ymd ? 'intern-tl-day' : undefined}
                      className={cn(
                        'text-center tracking-normal tabular-nums',
                        isToday && 'text-brand-text',
                        weekend && !isToday && 'text-ink-faint',
                        selectedDay === ymd && 'rounded-mark bg-brand-soft text-brand-text',
                      )}
                    >
                      {heading.weekday.charAt(0)} {heading.day}
                    </span>
                  );
                })}
              </div>
              {groups.map((group) => (
                <div key={group.id}>
                  <p className="flex items-center gap-2 border-b border-line-soft px-4 py-1.5 text-[12px] font-medium text-ink-muted">
                    <LeadCompanyChip name={group.name} compact />
                    <span className="truncate">{group.name}</span>
                  </p>
                  {group.rows.map((row) => {
                    const span = Math.max(1, row.endIdx - row.startIdx + 1);
                    const doneShare =
                      row.priority === 'ok' && todayIdx >= row.startIdx
                        ? Math.max(0, Math.min(1, (todayIdx + 1 - row.startIdx) / span))
                        : 0;
                    return (
                      <div key={row.item.id} className="relative grid border-b border-line-soft py-2 last:border-b-0" style={grid}>
                        <button
                          type="button"
                          onClick={() => onOpen(row.item)}
                          title={row.item.title}
                          className="min-w-0 truncate px-4 text-left text-[13px] font-medium text-ink hover:underline"
                          style={{ gridColumn: 1, gridRow: 1 }}
                        >
                          {row.item.title}
                        </button>
                        {todayIdx >= 0 ? (
                          <span
                            aria-hidden
                            className="pointer-events-none -my-2 flex justify-center"
                            style={{ gridColumn: `${todayIdx + 2} / span 1`, gridRow: 1 }}
                          >
                            <i className="block h-full w-0.5 bg-highlight-bright" />
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onOpen(row.item)}
                          title={`${row.item.title} · ${row.item.why}`}
                          className={cn(
                            'relative z-[1] flex h-4 min-w-0 items-center self-center overflow-hidden whitespace-nowrap rounded-bar px-1.5 text-[11px] font-medium hover:opacity-90',
                            BAR_TONE[row.priority],
                          )}
                          style={{ gridColumn: `${row.startIdx + 2} / ${row.endIdx + 3}`, gridRow: 1 }}
                        >
                          {doneShare > 0 ? (
                            <i className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${doneShare * 100}%` }} aria-hidden />
                          ) : null}
                          <span className={cn('relative truncate', doneShare > 0.5 && 'text-on-brand')}>{row.item.why}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </WorkCard>
      {gantt.later.length > 0 ? (
        <section className="surface min-w-0 overflow-hidden">
          <div className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-4">
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Later</h2>
            <span className="text-[12.5px] text-ink-muted tabular-nums">{gantt.later.length}</span>
          </div>
          <ListView items={gantt.later} now={now} onOpen={onOpen} />
        </section>
      ) : null}
    </div>
  );
}

function EmptyWork({ className }: { className?: string }) {
  return <EmptyState title="Nothing in this view" className={className} />;
}

export default function InternMyWork() {
  return (
    <Suspense fallback={<div className="text-[15px] text-ink-muted">Work</div>}>
      <InternMyWorkInner />
    </Suspense>
  );
}
