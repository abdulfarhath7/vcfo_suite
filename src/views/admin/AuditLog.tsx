"use client";

import { useCallback, useEffect, useId, useMemo, useReducer } from 'react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuditEventRow } from '@/lib/audit/audit-log';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { PlainPageHead } from '@/views/admin/PlainPageHead';
import { AuditTable } from '@/views/admin/audit-log/AuditTable';
import { defaultAuditFilters, type AuditFilters } from '@/views/admin/audit-log/audit-filters';

/* VCFO Spectrum audit log (prototype AuditScreen, C-0029 and C-0110): a plain white head, a
   segmented switch between every event and one project, and one card per view with the
   filters in its head and T1 rows. Fetching, filters and the project picker are unchanged. */

/** The cursor for the page older than the rows shown (G-28); null on the last page. */
type AuditCursor = { before: string; beforeId: string } | null;

type AuditPageBody = {
  ok: boolean;
  events?: AuditEventRow[];
  next?: AuditCursor;
  error?: string;
  detail?: string;
};

const PAGE_SIZE = 200;

function auditUrl(engagementId: string | null, cursor: AuditCursor): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (engagementId) params.set('engagementId', engagementId);
  if (cursor) {
    params.set('before', cursor.before);
    params.set('beforeId', cursor.beforeId);
  }
  return `/api/audit-logs?${params.toString()}`;
}

type AuditLogState = {
  tab: 'global' | 'project';
  globalNext: AuditCursor;
  projectNext: AuditCursor;
  loadingOlder: boolean;
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

const defaultFilters = defaultAuditFilters;

function auditLogReducer(state: AuditLogState, action: AuditLogAction): AuditLogState {
  return action.type === 'patch' ? { ...state, ...action.patch } : state;
}

export default function AuditLog() {
  const projectSelectId = useId();
  const { engagements } = useApp();
  const [state, dispatch] = useReducer(auditLogReducer, {
    tab: 'global',
    globalNext: null,
    projectNext: null,
    loadingOlder: false,
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
    globalNext,
    projectNext,
    loadingOlder,
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
      const res = await fetch(auditUrl(null, null));
      const body = (await res.json()) as AuditPageBody;
      if (!res.ok || !body.ok) {
        const msg =
          body.error === 'audit_table_missing'
            ? 'Audit log table is missing — run the database migrations (npm run db:migrate), then reload.'
            : `Could not load audit log (${body.error ?? res.status}${body.detail ? ': ' + body.detail : ''})`;
        dispatch({ type: 'patch', patch: { globalError: msg, globalEvents: [] } });
        return;
      }
      dispatch({ type: 'patch', patch: { globalEvents: body.events ?? [], globalNext: body.next ?? null } });
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
      const res = await fetch(auditUrl(engagementId, null));
      const body = (await res.json()) as AuditPageBody;
      if (!res.ok || !body.ok) {
        const msg =
          body.error === 'audit_table_missing'
            ? 'Audit log table is not deployed yet. Run the database migrations (npm run db:migrate).'
            : body.detail ?? body.error ?? 'Could not load project audit log.';
        dispatch({ type: 'patch', patch: { projectError: msg, projectEvents: [] } });
        return;
      }
      dispatch({ type: 'patch', patch: { projectEvents: body.events ?? [], projectNext: body.next ?? null } });
    } catch {
      dispatch({ type: 'patch', patch: { projectError: 'Could not load project audit log.', projectEvents: [] } });
    } finally {
      dispatch({ type: 'patch', patch: { projectLoading: false } });
    }
  }, []);

  /** "Load older": the next page after the last row shown, appended (G-28). */
  const loadOlder = useCallback(
    async (scope: 'global' | 'project') => {
      const cursor = scope === 'global' ? globalNext : projectNext;
      if (!cursor) return;
      const engagementId = scope === 'project' ? selectedEngagementId || null : null;
      dispatch({ type: 'patch', patch: { loadingOlder: true } });
      try {
        const res = await fetch(auditUrl(engagementId, cursor));
        const body = (await res.json()) as AuditPageBody;
        if (!res.ok || !body.ok) return;
        const older = body.events ?? [];
        dispatch({
          type: 'patch',
          patch:
            scope === 'global'
              ? { globalEvents: [...globalEvents, ...older], globalNext: body.next ?? null }
              : { projectEvents: [...projectEvents, ...older], projectNext: body.next ?? null },
        });
      } finally {
        dispatch({ type: 'patch', patch: { loadingOlder: false } });
      }
    },
    [globalNext, projectNext, selectedEngagementId, globalEvents, projectEvents],
  );

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
  const selectedName = sortedEngagements.find((e) => e.id === (selectedEngagementId || sortedEngagements[0]?.id))?.companyName;

  return (
    <PageTransition>
      <SEO
        title="Audit Log — VCFO Suite"
        description="Chronological audit trail of client, project lead, and manager actions."
        path="/app/manager/audit-log"
      />
      <PlainPageHead
        title="Audit log"
        meta={!globalLoading && eventCount > 0 ? `${eventCount} events loaded` : undefined}
        actions={
          <SpectrumTabs
            size="md"
            label="Audit view"
            items={[
              { key: 'global', label: 'All events' },
              { key: 'project', label: 'By project' },
            ]}
            value={tab}
            onChange={(v) => dispatch({ type: 'patch', patch: { tab: v as 'global' | 'project' } })}
          />
        }
      />

      {tab === 'global' ? (
        <AuditTable
          title="Audit log"
          events={globalEvents}
          engagementsByDbId={engagementsByDbId}
          loading={globalLoading}
          error={globalError}
          emptyMessage="No events yet"
          filters={globalFilters}
          onFiltersChange={(patch) =>
            dispatch({ type: 'patch', patch: { globalFilters: { ...globalFilters, ...patch } } })
          }
          exportName="audit-log.csv"
          onLoadOlder={globalNext ? () => void loadOlder('global') : undefined}
          loadingOlder={loadingOlder}
        />
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={projectSelectId} className="text-[13px] text-ink-muted">
              Project
            </label>
            <Select
              value={selectedEngagementId || sortedEngagements[0]?.id}
              onValueChange={handleProjectChange}
              disabled={!sortedEngagements.length}
            >
              <SelectTrigger id={projectSelectId} className="h-9 w-[min(100%,22rem)]">
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

          {!sortedEngagements.length ? (
            <EmptyState title="No projects yet" />
          ) : (
            <AuditTable
              title={selectedName ?? 'Project events'}
              events={projectEvents}
              engagementsByDbId={engagementsByDbId}
              loading={projectLoading}
              error={projectError}
              emptyMessage="No events recorded for this project yet"
              filters={projectFilters}
              onFiltersChange={(patch) =>
                dispatch({ type: 'patch', patch: { projectFilters: { ...projectFilters, ...patch } } })
              }
              showTarget={false}
              exportName="audit-log-project.csv"
              onLoadOlder={projectNext ? () => void loadOlder('project') : undefined}
              loadingOlder={loadingOlder}
            />
          )}
        </div>
      )}
    </PageTransition>
  );
}
