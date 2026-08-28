"use client";

import { useCallback, useEffect, useId, useMemo, useReducer, useState } from 'react';
import { m } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, History, Search, ScrollText } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { NoirCard } from '@/components/noir';
import { EmptyStateIllustrated } from '@/components/noir/EmptyStateIllustrated';
import type { AuditActionCategory, AuditEventRow } from '@/lib/audit-log';
import {
  formatActorDisplay,
  formatAuditActionLabel,
  formatAuditMetadata,
  getAuditActionCategory,
  getAuditTargetType,
} from '@/lib/audit-log';
import { mapDbRoleToAppRole, ROLE_UI_LABEL, type DbRole } from '@/lib/auth';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { cn } from '@/lib/utils';

function formatWhen(iso: string): { relative: string; absolute: string } {
  const date = new Date(iso);
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    absolute: format(date, 'dd MMM yyyy · HH:mm'),
  };
}

function RoleBadge({ role }: { role: DbRole }) {
  const appRole = mapDbRoleToAppRole(role);
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10.5px] font-medium uppercase tracking-wide',
        appRole === 'super_admin' && 'border-primary/40 bg-primary-light text-primary-dark',
        appRole === 'admin' && 'border-primary/25 bg-primary-light text-primary-dark',
        appRole === 'manager' && 'border-role/30 bg-role-soft text-role-foreground',
        appRole === 'intern' && 'border-info/20 bg-info-light text-info-text',
        appRole === 'client' && 'border-success/20 bg-success-light text-success-text',
      )}
    >
      {ROLE_UI_LABEL[appRole]}
    </span>
  );
}

type AuditFilters = {
  search: string;
  role: 'all' | DbRole;
  category: 'all' | AuditActionCategory;
};

const CATEGORY_LABELS: Record<AuditActionCategory, string> = {
  engagement: 'Projects',
  checklist: 'Milestones',
  documents: 'Documents',
  admin: 'Team',
  email: 'Email',
  other: 'Other',
};

function filterEvents(
  events: AuditEventRow[],
  filters: AuditFilters,
  engagementsByDbId: Map<string, string>,
): AuditEventRow[] {
  const query = filters.search.trim().toLowerCase();
  return events.filter((ev) => {
    if (filters.role !== 'all' && ev.actor_role !== filters.role) return false;
    if (filters.category !== 'all' && getAuditActionCategory(ev.action) !== filters.category) return false;
    if (!query) return true;

    const projectName = ev.engagement_id ? engagementsByDbId.get(ev.engagement_id) ?? '' : '';
    const haystack = [
      ev.summary,
      ev.action,
      formatAuditActionLabel(ev.action),
      formatActorDisplay(ev),
      ev.actor_email ?? '',
      ev.actor_name ?? '',
      projectName,
      getAuditTargetType(ev.action),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function AuditFiltersBar({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: AuditFilters;
  onChange: (patch: Partial<AuditFilters>) => void;
  shown: number;
  total: number;
}) {
  const searchId = useId();
  const roleId = useId();
  const categoryId = useId();

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-table-header/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <label htmlFor={searchId} className="sr-only">
          Search audit log
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
        <Input
          id={searchId}
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search actions, actors, projects…"
          className="h-9 border-hairline bg-panel pl-9 text-[13px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={roleId} className="sr-only">
          Filter by role
        </label>
        <Select
          value={filters.role}
          onValueChange={(v) => onChange({ role: v as AuditFilters['role'] })}
        >
          <SelectTrigger id={roleId} className="h-9 w-[8.5rem] border-hairline bg-panel text-[12.5px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="intern">Project lead</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>

        <label htmlFor={categoryId} className="sr-only">
          Filter by action type
        </label>
        <Select
          value={filters.category}
          onValueChange={(v) => onChange({ category: v as AuditFilters['category'] })}
        >
          <SelectTrigger id={categoryId} className="h-9 w-[9.5rem] border-hairline bg-panel text-[12.5px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as AuditActionCategory[]).map((key) => (
              <SelectItem key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[11.5px] text-text-tertiary sm:ml-auto">
        {shown === total ? (
          <span>{total} events</span>
        ) : (
          <span>
            {shown} of {total} events
          </span>
        )}
      </p>
    </div>
  );
}

function AuditEventRowView({
  ev,
  projectName,
  index,
  showTarget,
}: {
  ev: AuditEventRow;
  projectName: string | null;
  index: number;
  showTarget: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const when = formatWhen(ev.created_at);
  const actionLabel = formatAuditActionLabel(ev.action);
  const metadataText = formatAuditMetadata(ev.metadata);
  const actorName = ev.actor_name?.trim();
  const actorEmail = ev.actor_email?.trim();
  const targetType = getAuditTargetType(ev.action);

  return (
    <div className="border-b border-hairline/60 last:border-b-0">
      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.015 * Math.min(index, 12) }}
        className="grid grid-cols-1 gap-3 px-4 py-3.5 hover:bg-muted/30 sm:grid-cols-[minmax(7rem,8.5rem)_minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_2rem] sm:items-start sm:gap-x-4"
      >
        <div className="min-w-0 sm:pt-0.5">
          <div className="text-[12px] font-medium text-ink">{when.relative}</div>
          <time className="mono mt-0.5 block text-[10.5px] tabular-nums text-text-tertiary">
            {when.absolute}
          </time>
        </div>

        <div className="min-w-0">
          <div className="text-[13px] font-medium leading-snug text-ink">{actionLabel}</div>
          {ev.summary && ev.summary !== actionLabel && (
            <p className="mt-1 text-[12px] leading-snug text-ink-soft">{ev.summary}</p>
          )}
          <span className="mono mt-1.5 inline-block text-[10px] text-text-tertiary sm:hidden">
            {ev.action}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <RoleBadge role={ev.actor_role} />
          </div>
          <div className="mt-1.5 truncate text-[12.5px] text-ink">
            {actorName || actorEmail || 'Unknown actor'}
          </div>
          {actorName && actorEmail && (
            <div className="mono mt-0.5 truncate text-[10.5px] text-text-tertiary">{actorEmail}</div>
          )}
        </div>

        {showTarget ? (
          <div className="min-w-0">
            <span className="inline-flex h-5 items-center rounded-full border border-hairline bg-muted/50 px-2 text-[10.5px] font-medium text-ink-soft">
              {targetType}
            </span>
            <div className="mt-1.5 truncate text-[12.5px] text-ink">
              {projectName ?? '—'}
            </div>
            {ev.engagement_id && (
              <div className="mono mt-0.5 truncate text-[10px] text-text-tertiary">
                {ev.engagement_id.slice(0, 8)}…
              </div>
            )}
          </div>
        ) : (
          <div className="hidden sm:block" aria-hidden />
        )}

        <div className="flex items-start justify-end sm:pt-0.5">
          {metadataText ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md border border-hairline text-text-tertiary transition-colors hover:bg-muted hover:text-ink',
                expanded && 'bg-muted text-ink',
              )}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide event details' : 'Show event details'}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
            </button>
          ) : (
            <span className="h-7 w-7" aria-hidden />
          )}
        </div>
      </m.div>

      {expanded && metadataText && (
        <div className="border-t border-hairline/50 bg-muted/20 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
            Metadata
          </p>
          <pre className="mono max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-ink-soft">
            {metadataText}
          </pre>
          <p className="mono mt-2 text-[10px] text-text-tertiary">{ev.action}</p>
        </div>
      )}
    </div>
  );
}

function AuditTable({
  events,
  engagementsByDbId,
  loading,
  emptyMessage,
  filters,
  onFiltersChange,
  showTarget = true,
}: {
  events: AuditEventRow[];
  engagementsByDbId: Map<string, string>;
  loading: boolean;
  emptyMessage: string;
  filters: AuditFilters;
  onFiltersChange: (patch: Partial<AuditFilters>) => void;
  showTarget?: boolean;
}) {
  const filtered = useMemo(
    () => filterEvents(events, filters, engagementsByDbId),
    [events, filters, engagementsByDbId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HexgridLoader />
      </div>
    );
  }

  return (
    <>
      <AuditFiltersBar
        filters={filters}
        onChange={onFiltersChange}
        shown={filtered.length}
        total={events.length}
      />

      {!events.length ? (
        <EmptyStateIllustrated
          icon={ScrollText}
          title="No audit events yet"
          description={emptyMessage}
          className="m-4 border-0 bg-transparent"
        />
      ) : !filtered.length ? (
        <EmptyStateIllustrated
          icon={Search}
          title="No matching events"
          description="Try clearing your search or broadening the role and type filters."
          className="m-4 border-0 bg-transparent"
        />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
            <div
              className={cn(
                'grid gap-x-4 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground bg-table-header border-b border-border',
                showTarget
                  ? 'grid-cols-[minmax(7rem,8.5rem)_minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_2rem]'
                  : 'grid-cols-[minmax(7rem,8.5rem)_minmax(0,2fr)_minmax(0,1.35fr)_2rem]',
              )}
            >
              <span>When</span>
              <span>What happened</span>
              <span>Who</span>
              {showTarget && <span>Target</span>}
              <span className="sr-only">Details</span>
            </div>

            {filtered.map((ev, index) => {
              const projectName = ev.engagement_id
                ? engagementsByDbId.get(ev.engagement_id) ?? 'Unknown project'
                : null;
              return (
                <AuditEventRowView
                  key={ev.id}
                  ev={ev}
                  projectName={projectName}
                  index={index}
                  showTarget={showTarget}
                />
              );
            })}
          </div>
        </div>
      )}

    </>
  );
}

type AuditLogState = {
  tab: 'global' | 'project';
  selectedEngagementId: string;
  globalEvents: AuditEventRow[];
  projectEvents: AuditEventRow[];
  globalLoading: boolean;
  projectLoading: boolean;
  globalError: string | null;
  projectError: string | null;
  globalFilters: AuditFilters;
  projectFilters: AuditFilters;
};

type AuditLogAction = { type: 'patch'; patch: Partial<AuditLogState> };

const defaultFilters = (): AuditFilters => ({
  search: '',
  role: 'all',
  category: 'all',
});

function auditLogReducer(state: AuditLogState, action: AuditLogAction): AuditLogState {
  return action.type === 'patch' ? { ...state, ...action.patch } : state;
}

export default function AuditLog() {
  const projectSelectId = useId();
  const { engagements } = useApp();
  const [state, dispatch] = useReducer(auditLogReducer, {
    tab: 'global',
    selectedEngagementId: '',
    globalEvents: [],
    projectEvents: [],
    globalLoading: true,
    projectLoading: false,
    globalError: null,
    projectError: null,
    globalFilters: defaultFilters(),
    projectFilters: defaultFilters(),
  });
  const {
    tab,
    selectedEngagementId,
    globalEvents,
    projectEvents,
    globalLoading,
    projectLoading,
    globalError,
    projectError,
    globalFilters,
    projectFilters,
  } = state;

  const sortedEngagements = useMemo(
    () => engagements.toSorted((a, b) => a.companyName.localeCompare(b.companyName)),
    [engagements],
  );

  const engagementsByDbId = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of engagements) {
      map.set(engagementDbId(e.id), e.companyName);
    }
    return map;
  }, [engagements]);

  const fetchGlobal = useCallback(async () => {
    dispatch({ type: 'patch', patch: { globalLoading: true, globalError: null } });
    try {
      const res = await fetch('/api/audit-logs?limit=200');
      const body = (await res.json()) as {
        ok: boolean;
        events?: AuditEventRow[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.ok) {
        const msg =
          body.error === 'audit_table_missing'
            ? 'audit_events table missing — run supabase/migrations/20260529120000_audit_events.sql in Supabase SQL Editor, then reload.'
            : `Could not load audit log (${body.error ?? res.status}${body.detail ? ': ' + body.detail : ''})`;
        dispatch({ type: 'patch', patch: { globalError: msg, globalEvents: [] } });
        return;
      }
      dispatch({ type: 'patch', patch: { globalEvents: body.events ?? [] } });
    } catch (err) {
      dispatch({
        type: 'patch',
        patch: {
          globalError: `Network error: ${err instanceof Error ? err.message : 'Could not reach audit API.'}`,
          globalEvents: [],
        },
      });
    } finally {
      dispatch({ type: 'patch', patch: { globalLoading: false } });
    }
  }, []);

  const fetchProject = useCallback(async (engagementId: string) => {
    if (!engagementId) {
      dispatch({ type: 'patch', patch: { projectEvents: [] } });
      return;
    }
    dispatch({ type: 'patch', patch: { projectLoading: true, projectError: null } });
    try {
      const res = await fetch(
        `/api/audit-logs?engagementId=${encodeURIComponent(engagementId)}&limit=200`,
      );
      const body = (await res.json()) as {
        ok: boolean;
        events?: AuditEventRow[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.ok) {
        const msg =
          body.error === 'audit_table_missing'
            ? 'Audit log table is not deployed yet. Apply the latest Supabase migration.'
            : body.detail ?? body.error ?? 'Could not load project audit log.';
        dispatch({ type: 'patch', patch: { projectError: msg, projectEvents: [] } });
        return;
      }
      dispatch({ type: 'patch', patch: { projectEvents: body.events ?? [] } });
    } catch {
      dispatch({ type: 'patch', patch: { projectError: 'Could not load project audit log.', projectEvents: [] } });
    } finally {
      dispatch({ type: 'patch', patch: { projectLoading: false } });
    }
  }, []);

  useEffect(() => {
    void fetchGlobal();
  }, [fetchGlobal]);

  useEffect(() => {
    if (tab !== 'project') return;
    const defaultId = selectedEngagementId || sortedEngagements[0]?.id || '';
    if (!selectedEngagementId && defaultId) {
      dispatch({ type: 'patch', patch: { selectedEngagementId: defaultId } });
      return;
    }
    if (defaultId) void fetchProject(defaultId);
  }, [tab, selectedEngagementId, sortedEngagements, fetchProject]);

  const handleProjectChange = (engagementId: string) => {
    dispatch({ type: 'patch', patch: { selectedEngagementId: engagementId, projectFilters: defaultFilters() } });
    void fetchProject(engagementId);
  };

  const eventCount = tab === 'global' ? globalEvents.length : projectEvents.length;

  return (
    <PageTransition>
      <SEO
        title="Audit Log — VCFO Suite"
        description="Chronological audit trail of client, project lead, and manager actions."
        path="/app/manager/audit-log"
      />
      <PageHeader
        title="Audit Log"
        actions={
          !globalLoading && eventCount > 0 ? (
            <span className="mono rounded-full border border-hairline bg-panel px-3 py-1.5 text-[11px] text-text-tertiary">
              {eventCount} recent events
            </span>
          ) : null
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => dispatch({ type: 'patch', patch: { tab: v as 'global' | 'project' } })}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-hairline bg-transparent p-0">
          <TabsTrigger
            value="global"
            className="rounded-none border-b-2 border-transparent px-4 pb-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            <History className="mr-1.5 h-3.5 w-3.5" />
            Global logs
          </TabsTrigger>
          <TabsTrigger
            value="project"
            className="rounded-none border-b-2 border-transparent px-4 pb-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            By project
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-0">
          <NoirCard className="overflow-hidden p-0 shadow-layered-lg">
            {globalError && (
              <div className="border-b border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning-text">
                {globalError}
              </div>
            )}
            <AuditTable
              events={globalEvents}
              engagementsByDbId={engagementsByDbId}
              loading={globalLoading}
              emptyMessage="No events yet."
              filters={globalFilters}
              onFiltersChange={(patch) =>
                dispatch({ type: 'patch', patch: { globalFilters: { ...globalFilters, ...patch } } })
              }
            />
          </NoirCard>
        </TabsContent>

        <TabsContent value="project" className="mt-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={projectSelectId} className="text-[12px] text-paper-muted">
              Project
            </label>
            <Select
              value={selectedEngagementId || sortedEngagements[0]?.id}
              onValueChange={handleProjectChange}
              disabled={!sortedEngagements.length}
            >
              <SelectTrigger id={projectSelectId} className="w-[min(100%,22rem)] border-hairline bg-panel">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {sortedEngagements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NoirCard className="overflow-hidden p-0 shadow-layered-lg">
            {projectError && (
              <div className="border-b border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning-text">
                {projectError}
              </div>
            )}
            {!sortedEngagements.length ? (
              <EmptyStateIllustrated
                icon={ScrollText}
                title="No projects yet"
                className="m-4 border-0 bg-transparent"
              />
            ) : (
              <AuditTable
                events={projectEvents}
                engagementsByDbId={engagementsByDbId}
                loading={projectLoading}
                emptyMessage="No events recorded for this project yet."
                filters={projectFilters}
                onFiltersChange={(patch) =>
                  dispatch({ type: 'patch', patch: { projectFilters: { ...projectFilters, ...patch } } })
                }
                showTarget={false}
              />
            )}
          </NoirCard>
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
