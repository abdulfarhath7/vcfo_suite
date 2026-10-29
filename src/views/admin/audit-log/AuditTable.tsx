'use client';

import { useId, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { AreaPill, Chip } from '@/components/ui/spectrum-chip';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { AuditActionCategory, AuditEventRow } from '@/lib/audit/audit-log';
import {
  AUDIT_RESULT_LABEL,
  auditResultOf,
  formatAuditActionLabel,
  formatAuditMetadata,
  getAuditActionCategory,
  getAuditTargetType,
} from '@/lib/audit/audit-log';
import { mapDbRoleToAppRole, ROLE_UI_LABEL } from '@/lib/auth';
import {
  AUDIT_CATEGORY_LABELS,
  auditFiltersSet,
  defaultAuditFilters,
  filterAuditEvents,
  type AuditFilters,
} from '@/views/admin/audit-log/audit-filters';
import { auditEventsCsv, downloadCsv } from '@/views/admin/audit-log/audit-csv';

/** Plain date and time, for example "14 Oct 10:42" (R-05); the year shows only when it is not this year. */
function plainWhen(iso: string): string {
  const d = new Date(iso);
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'd MMM HH:mm' : 'd MMM yyyy HH:mm');
}

function actorName(ev: AuditEventRow): string {
  return ev.actor_name?.trim() || ev.actor_email?.trim() || 'Unknown actor';
}

const roleLabel = (ev: AuditEventRow) => ROLE_UI_LABEL[mapDbRoleToAppRole(ev.actor_role)];

/** The Result cell (G-28): a quiet "Done", a red "Failed" or an amber "Denied". */
function ResultChip({ ev }: { ev: AuditEventRow }) {
  const result = auditResultOf(ev);
  if (result === 'ok') return <span className="text-[12.5px] text-ink-muted">{AUDIT_RESULT_LABEL.ok}</span>;
  return (
    <Chip fixed tone={result === 'failed' ? 'bad' : 'warn'}>
      {AUDIT_RESULT_LABEL[result]}
    </Chip>
  );
}

/** Filters in the card head (prototype Audit): search, area, who, export. */
function AuditHeadFilters({
  filters,
  onChange,
  events,
  onExport,
}: {
  filters: AuditFilters;
  onChange: (patch: Partial<AuditFilters>) => void;
  events: AuditEventRow[];
  onExport: () => void;
}) {
  const searchId = useId();
  const roleId = useId();
  const categoryId = useId();
  const count = (key: AuditActionCategory) => events.filter((e) => getAuditActionCategory(e.action) === key).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={searchId} className="relative inline-flex">
        <span className="sr-only">Search the audit log</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input
          id={searchId}
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search"
          className="h-[30px] w-[170px] rounded-md border-1.5 border-line-strong bg-surface-raised pl-8 pr-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-focus-ring/25"
        />
      </label>

      <label htmlFor={categoryId} className="sr-only">
        Area
      </label>
      <Select value={filters.category} onValueChange={(v) => onChange({ category: v as AuditFilters['category'] })}>
        <SelectTrigger id={categoryId} className="h-[30px] w-[150px] text-[13px]">
          <SelectValue placeholder="All areas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All areas</SelectItem>
          {(Object.keys(AUDIT_CATEGORY_LABELS) as AuditActionCategory[]).map((key) => (
            <SelectItem key={key} value={key}>
              {AUDIT_CATEGORY_LABELS[key]} · {count(key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label htmlFor={roleId} className="sr-only">
        Who
      </label>
      <Select value={filters.role} onValueChange={(v) => onChange({ role: v as AuditFilters['role'] })}>
        <SelectTrigger id={roleId} className="h-[30px] w-[140px] text-[13px]">
          <SelectValue placeholder="Everyone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everyone</SelectItem>
          <SelectItem value="manager">Manager</SelectItem>
          <SelectItem value="intern">Project lead</SelectItem>
          <SelectItem value="client">Client</SelectItem>
        </SelectContent>
      </Select>

      <Button size="sm" variant="outline" onClick={onExport} disabled={events.length === 0}>
        <Download className="h-3.5 w-3.5" aria-hidden />
        Export
      </Button>
    </div>
  );
}

/** One event in a side panel (prototype Audit SidePanel): what, when, who, target and the raw details. */
function AuditEventPanel({
  ev,
  projectName,
  onClose,
}: {
  ev: AuditEventRow | null;
  projectName: string | null;
  onClose: () => void;
}) {
  const metadataText = ev ? formatAuditMetadata(ev.metadata) : null;
  return (
    <Sheet open={ev !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px]">
        {ev ? (
          <div className="grid gap-5">
            <div className="pr-8">
              <p className="text-[12.5px] text-ink-muted">
                {format(new Date(ev.created_at), 'd MMM yyyy · HH:mm')} ·{' '}
                {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
              </p>
              <SheetTitle className="mt-1 text-[18px] font-medium leading-snug">{formatAuditActionLabel(ev.action)}</SheetTitle>
              <div className="mt-2">
                <AreaPill area={AUDIT_CATEGORY_LABELS[getAuditActionCategory(ev.action)]} />
              </div>
            </div>

            <dl className="grid gap-3 text-[13.5px]">
              {ev.summary ? (
                <div>
                  <dt className="text-[12.5px] text-ink-muted">Summary</dt>
                  <dd className="text-ink">{ev.summary}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[12.5px] text-ink-muted">By</dt>
                <dd className="text-ink">
                  {actorName(ev)} · {roleLabel(ev)}
                </dd>
                {ev.actor_name && ev.actor_email ? <dd className="text-[12.5px] text-ink-muted">{ev.actor_email}</dd> : null}
              </div>
              <div>
                <dt className="text-[12.5px] text-ink-muted">Result</dt>
                <dd className="text-ink">{AUDIT_RESULT_LABEL[auditResultOf(ev)]}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-ink-muted">Target</dt>
                <dd className="text-ink">
                  {getAuditTargetType(ev.action)}
                  {projectName ? ` · ${projectName}` : ''}
                </dd>
                {ev.engagement_id ? <dd className="font-mono text-[12px] text-ink-muted">{ev.engagement_id}</dd> : null}
              </div>
            </dl>

            {metadataText ? (
              <section>
                <h3 className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Details</h3>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border-1.5 border-line bg-surface-sunken px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-2">
                  {metadataText}
                </pre>
              </section>
            ) : null}
            <p className="font-mono text-[12px] text-ink-faint">{ev.action}</p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The audit card (prototype AuditScreen, R-07): filters in the head, T1 rows, page numbers
 * under the table. A row opens the event in a side panel.
 */
export function AuditTable({
  title,
  events,
  engagementsByDbId,
  loading,
  error,
  emptyMessage,
  filters,
  onFiltersChange,
  showTarget = true,
  exportName,
  onLoadOlder,
  loadingOlder = false,
}: {
  title: string;
  events: AuditEventRow[];
  engagementsByDbId: Map<string, string>;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  filters: AuditFilters;
  onFiltersChange: (patch: Partial<AuditFilters>) => void;
  showTarget?: boolean;
  exportName: string;
  /** Set while an older page exists (G-28); the button fetches it and the rows append. */
  onLoadOlder?: () => void;
  loadingOlder?: boolean;
}) {
  const [picked, setPicked] = useState<AuditEventRow | null>(null);
  const filtered = useMemo(
    () => filterAuditEvents(events, filters, engagementsByDbId),
    [events, filters, engagementsByDbId],
  );
  const projectOf = (ev: AuditEventRow) =>
    ev.engagement_id ? engagementsByDbId.get(ev.engagement_id) ?? 'Unknown project' : null;

  const columns: EFilingColumn<AuditEventRow>[] = [
    {
      key: 'when',
      header: 'When',
      width: '128px',
      render: (ev) => (
        <time dateTime={ev.created_at} title={formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })} className="text-[13px] tabular-nums">
          {plainWhen(ev.created_at)}
        </time>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      render: (ev) => {
        const label = formatAuditActionLabel(ev.action);
        return (
          <span className="block min-w-0">
            <button
              type="button"
              className="block max-w-full truncate text-left font-medium text-ink hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setPicked(ev);
              }}
            >
              {label}
            </button>
            {ev.summary && ev.summary !== label ? (
              <span className="block truncate text-[12.5px] text-ink-muted">{ev.summary}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'area',
      header: 'Area',
      width: '124px',
      render: (ev) => <AreaPill area={AUDIT_CATEGORY_LABELS[getAuditActionCategory(ev.action)]} />,
    },
    {
      key: 'who',
      header: 'Who',
      width: '180px',
      render: (ev) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{actorName(ev)}</span>
          <span className="block truncate text-[12.5px] text-ink-muted">{roleLabel(ev)}</span>
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      width: '96px',
      render: (ev) => <ResultChip ev={ev} />,
    },
    ...(showTarget
      ? [
          {
            key: 'target',
            header: 'Target',
            width: '180px',
            render: (ev: AuditEventRow) => (
              <span className="block min-w-0">
                <span className="block truncate text-ink">{projectOf(ev) ?? '—'}</span>
                <span className="block truncate text-[12.5px] text-ink-muted">{getAuditTargetType(ev.action)}</span>
              </span>
            ),
          },
        ]
      : []),
  ];

  const isFiltered = auditFiltersSet(filters);

  return (
    <section className="surface min-w-0 overflow-hidden">
      <header className="flex min-h-[52px] flex-wrap items-center gap-2.5 border-b border-line-soft px-4 py-2">
        <h2 className="whitespace-nowrap text-[15px] font-medium text-ink">{title}</h2>
        {!loading ? (
          <span className="truncate text-[13px] text-ink-muted">
            {filtered.length === events.length ? `${events.length} events` : `${filtered.length} of ${events.length} events`}
          </span>
        ) : null}
        <div className="ml-auto">
          <AuditHeadFilters
            filters={filters}
            onChange={onFiltersChange}
            events={events}
            onExport={() => downloadCsv(auditEventsCsv(filtered, engagementsByDbId), exportName)}
          />
        </div>
      </header>

      {error ? (
        <div role="alert" className="border-b border-line-soft bg-warning-soft px-4 py-3 text-[13px] text-warning">
          {error}
        </div>
      ) : null}

      <div className="px-4 pb-3 pt-1">
        {loading ? (
          <SkeletonRows rows={6} className="pt-2" />
        ) : events.length === 0 ? (
          <EmptyState title={emptyMessage} className="mt-2" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No events match these filters"
            className="mt-2"
            action={
              <Button size="sm" variant="outline" onClick={() => onFiltersChange(defaultAuditFilters())}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <EFilingGrid
              columns={columns}
              rows={filtered}
              rowKey={(ev) => ev.id}
              pageSize={25}
              minWidth={showTarget ? 916 : 756}
              caption={title}
              onRowClick={(ev: AuditEventRow) => setPicked(ev)}
            />
            {isFiltered ? (
              <div className="mt-2">
                <Button size="sm" variant="ghost" onClick={() => onFiltersChange(defaultAuditFilters())}>
                  Clear filters
                </Button>
              </div>
            ) : null}
          </>
        )}
        {!loading && onLoadOlder ? (
          <div className="mt-3 flex justify-center">
            <Button size="sm" variant="outline" disabled={loadingOlder} onClick={onLoadOlder}>
              {loadingOlder ? 'Loading…' : 'Load older'}
            </Button>
          </div>
        ) : null}
      </div>

      <AuditEventPanel ev={picked} projectName={picked ? projectOf(picked) : null} onClose={() => setPicked(null)} />
    </section>
  );
}
