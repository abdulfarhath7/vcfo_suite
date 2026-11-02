'use client';

/**
 * AUDIT LOG — /app/manager/audit-log and /app/intern/audit-log (prototype
 * a59s mxRenderers.audit: facets on the left, a spine of events by day).
 *
 * Live functions kept (src/views/admin/AuditLog.tsx on origin/main): Global logs
 * and By project (project picker, first project by name, its own filters, reset
 * when the project changes); search over action, summary, actor, email, project
 * and target; the role filter (Manager / Project lead / Client) and the type
 * filter (Projects, Milestones, Documents, Team, Email, Other); "N of M events";
 * each event's time, action, summary, who with their role, target and project;
 * expand a row for its metadata and action code; the live error and empty
 * messages; 200 events per read. Added from the prototype on real data: the
 * 14-day strip (a bar opens that day, Shift-click filters to it), events grouped
 * by day, the Details doors (Open step / Open client), Export CSV of the events
 * shown, Load older (GET /api/audit-logs?before=…), and the Stage filter.
 */
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { formatAuditActionLabel, getAuditActionCategory, getAuditTargetType, type AuditActionCategory, type AuditEventRow } from '@/lib/audit-log';
import { mergeAuditPages, nextAuditBefore } from '@/lib/audit-paging';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { useConsole, useCrumbs } from '../../runtime';
import { Drill, type DrillTab } from '../../overlays';
import { Btn, Icon, Seg, Select, type IconName } from '../../ui';
import { stageOf } from '../today/model';
import { useTodayIso } from '../today/useToday';
import {
  auditCsv,
  CATEGORY_ICON,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  dayStrip,
  eventLinks,
  facetCounts,
  filterEvents,
  groupByDay,
  inStage,
  metadataFacts,
  NO_FILTERS,
  projectText,
  roleLabel,
  WHO_OPTIONS,
  type AuditFilters,
  type WhoFilter,
} from './audit-model';
import { dayName, downloadText, dWords, istDayOf, plural, stampLong, timeIst, weekdayOf } from './fmt';
import { EmptyNote, ErrorBox } from './shared';

const LIMIT = 200;
type Mode = 'global' | 'project';

type ApiBody = { ok: boolean; events?: AuditEventRow[]; error?: string; detail?: string };

/** One read of the feed, with the live view's error wording for each tab. */
async function fetchAuditPage(engagementId: string | null, before: string): Promise<AuditEventRow[]> {
  const q = new URLSearchParams();
  if (engagementId) q.set('engagementId', engagementId);
  q.set('limit', String(LIMIT));
  if (before) q.set('before', before);
  let res: Response;
  let body: ApiBody;
  try {
    res = await fetch(`/api/audit-logs?${q.toString()}`);
    body = (await res.json()) as ApiBody;
  } catch (err) {
    if (engagementId) throw new Error('Could not load project audit log.');
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'Could not reach audit API.'}`);
  }
  if (!res.ok || !body.ok) {
    if (engagementId) {
      throw new Error(
        body.error === 'audit_table_missing'
          ? 'Audit log table is not deployed yet. Run the database migrations (npm run db:migrate).'
          : body.detail ?? body.error ?? 'Could not load project audit log.',
      );
    }
    throw new Error(
      body.error === 'audit_table_missing'
        ? 'Audit log table is missing — run the database migrations (npm run db:migrate), then reload.'
        : `Could not load audit log (${body.error ?? res.status}${body.detail ? ': ' + body.detail : ''})`,
    );
  }
  return body.events ?? [];
}

function useAuditFeed(engagementId: string | null, enabled: boolean) {
  const { user } = useApp();
  return useInfiniteQuery({
    queryKey: ['audit-log', user?.id, engagementId ?? '@global'],
    initialPageParam: '',
    queryFn: ({ pageParam }) => fetchAuditPage(engagementId, pageParam as string),
    getNextPageParam: (last: AuditEventRow[], all: AuditEventRow[][]) => (last.length >= LIMIT ? nextAuditBefore(all.flat()) : undefined),
    enabled: enabled && Boolean(user),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function AuditPage() {
  useCrumbs(['Audit log']);
  const { engagements, getStateForEngagement } = useApp();
  const { base, scope, go, openPop, toast } = useConsole();
  const today = useTodayIso();

  const [mode, setMode] = useState<Mode>('global');
  const [projectId, setProjectId] = useState('');
  const [filters, setFilters] = useState<Record<Mode, AuditFilters>>({ global: NO_FILTERS, project: NO_FILTERS });
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const f = filters[mode];
  const patch = (p: Partial<AuditFilters>) => setFilters((all) => ({ ...all, [mode]: { ...all[mode], ...p } }));

  /* the book: names, stages and links per database id */
  const book = useMemo(() => {
    const byDb = new Map<string, Engagement>();
    const stage = new Map<string, 'inc' | 'cmp'>();
    for (const e of engagements) {
      const id = engagementDbId(e.id);
      byDb.set(id, e);
      stage.set(id, stageOf(e, getStateForEngagement(e)));
    }
    return { byDb, stage };
  }, [engagements, getStateForEngagement]);
  const nameOf = (dbId: string) => book.byDb.get(dbId)?.companyName;

  const projects = useMemo(
    () => [...engagements].sort((a, b) => a.companyName.localeCompare(b.companyName)).filter((e) => scope === 'all' || book.stage.get(engagementDbId(e.id)) === scope),
    [engagements, scope, book],
  );
  const pid = projects.some((e) => e.id === projectId) ? projectId : projects[0]?.id ?? '';
  const project = projects.find((e) => e.id === pid);

  const globalQ = useAuditFeed(null, true);
  const projectQ = useAuditFeed(pid || null, mode === 'project' && Boolean(pid));
  const q = mode === 'global' ? globalQ : projectQ;

  const loaded = useMemo(() => mergeAuditPages(q.data?.pages ?? []), [q.data]);
  const scoped = useMemo(() => inStage(loaded, scope, (id) => book.stage.get(id)), [loaded, scope, book]);
  const shown = useMemo(() => filterEvents(scoped, f, nameOf), [scoped, f, book]); // eslint-disable-line react-hooks/exhaustive-deps
  const strip = useMemo(() => dayStrip(scoped, today), [scoped, today]);
  const counts = useMemo(() => facetCounts(scoped), [scoped]);
  const groups = useMemo(() => groupByDay(shown), [shown]);
  const maxBar = Math.max(1, ...strip.map((s) => s.n));
  const oldestDay = loaded.length ? istDayOf(loaded[loaded.length - 1]!.created_at) ?? '' : '';
  const partial = Boolean(q.hasNextPage) && oldestDay > strip[0]!.day;

  const filtered = f.search.trim() !== '' || f.role !== 'all' || f.category !== 'all' || f.day !== '';
  const countText = q.isLoading ? 'Loading…' : filtered ? `${shown.length} of ${plural(scoped.length, 'event')}` : plural(scoped.length, 'event');

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const changeProject = (id: string) => {
    setProjectId(id);
    setFilters((all) => ({ ...all, project: NO_FILTERS }));
  };

  const openDay = (day: string, el: Element) => {
    const active = strip.filter((s) => s.n > 0);
    const tabs: DrillTab[] = active.map((s) => ({
      label: s.day === today ? 'Today' : `${weekdayOf(s.day)} ${Number(s.day.slice(8))}`,
      rows: scoped
        .filter((ev) => istDayOf(ev.created_at) === s.day)
        .map((ev) => ({
          id: ev.id,
          title: formatAuditActionLabel(ev.action),
          meta: [ev.summary, ev.actor_name?.trim() || ev.actor_email?.trim() || 'Unknown actor'].filter(Boolean).join(' · '),
          state: timeIst(ev.created_at),
          color: 'var(--ink-3)',
          onOpen: () => {
            patch({ day: s.day });
            setOpen((o) => new Set(o).add(ev.id));
          },
        })),
    }));
    const n = strip.find((s) => s.day === day)?.n ?? 0;
    openPop(
      el,
      <Drill
        title={`Events on ${dWords(day, today)}`}
        sub={`${plural(n, 'event')} · Shift-click a bar to filter the log`}
        tabs={tabs}
        active={Math.max(0, active.findIndex((s) => s.day === day))}
        link={{ text: `Show only ${dWords(day, today)}`, onClick: () => patch({ day }) }}
      />,
      { cls: 'mx-wide' },
    );
  };

  const onBar = (day: string, e: MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey) patch({ day: f.day === day ? '' : day });
    else openDay(day, e.currentTarget);
  };

  const exportCsv = () => {
    const name = mode === 'project' && project ? `audit-log-${project.slug ?? 'project'}-${today}.csv` : `audit-log-${today}.csv`;
    toast(downloadText(name, auditCsv(shown, nameOf)) ? `${name} downloaded` : 'This browser blocked the download');
  };

  const typeOpts: Array<{ k: 'all' | AuditActionCategory; label: string; n: number; ico?: IconName }> = [
    { k: 'all', label: 'All types', n: counts.category.all ?? 0 },
    ...CATEGORY_ORDER.map((c) => ({ k: c, label: CATEGORY_LABELS[c], n: counts.category[c] ?? 0, ico: CATEGORY_ICON[c] })),
  ];
  const whoOpts = WHO_OPTIONS.map(([k, label]) => ({ k, label, n: counts.role[k] ?? 0 }));

  let body: ReactNode;
  if (mode === 'project' && !projects.length) {
    body = <EmptyNote icon="grid" title="No projects yet" sub={scope === 'all' ? 'Each project’s own log shows here once a project is in your book.' : 'No client in this stage. Switch the stage to All to see every project.'} />;
  } else if (q.isLoading) {
    body = <div className="sec-load">Loading the audit log…</div>;
  } else if (q.isError && !loaded.length) {
    body = <ErrorBox title="The audit log did not load" detail={q.error instanceof Error ? q.error.message : undefined} onRetry={() => void q.refetch()} />;
  } else if (!scoped.length) {
    body =
      loaded.length && scope !== 'all' ? (
        <EmptyNote icon="hist" title={scope === 'inc' ? 'No events for incorporating clients' : 'No events for compliance clients'} sub="Switch the stage to All to see every event." />
      ) : (
        <EmptyNote
          icon="hist"
          title="No audit events yet"
          sub={mode === 'global' ? 'What you, your team and your clients do on your projects shows here as it happens.' : 'No events recorded for this project yet.'}
        />
      );
  } else if (!shown.length) {
    body = <EmptyNote icon="search" title="No matching events" sub={`Try clearing your search or broadening the role and type filters${f.day ? ', or clear the day' : ''}.`} />;
  } else {
    body = groups.map((g) => (
      <div key={g.day} className="mx-spd">
        <div className="mx-spdh">
          <b>{dayName(g.day, today)}</b>
          <span>{dWords(g.day, today)}</span>
          <em>{plural(g.events.length, 'event')}</em>
        </div>
        {g.events.map((ev) => (
          <EventRow
            key={ev.id}
            ev={ev}
            eng={ev.engagement_id ? book.byDb.get(ev.engagement_id) : undefined}
            project={projectText(ev, nameOf)}
            showTarget={mode === 'global'}
            open={open.has(ev.id)}
            onToggle={() => toggle(ev.id)}
            base={base}
            go={go}
          />
        ))}
      </div>
    ));
  }

  return (
    <>
      <div className="sec-h">
        <h2>Audit log</h2>
        <span className="sec-count">{countText}</span>
        <span className="sp" />
        <Seg<Mode>
          className="sm"
          ariaLabel="Which log"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'global', label: 'Global logs' },
            { value: 'project', label: 'By project' },
          ]}
        />
      </div>
      <div className="mx-aud">
        <aside className="glass mx-facets" aria-label="Filter the log">
          {mode === 'project' ? (
            <div className="mx-fac">
              <span className="eyebrow">Project</span>
              {projects.length ? (
                <Select<string> cls="full" label="Project" value={pid} onChange={changeProject} options={projects.map((e) => [e.id, e.companyName] as [string, string])} />
              ) : (
                <span className="small">No projects yet</span>
              )}
            </div>
          ) : null}
          <div className="search mx-q">
            <Icon name="search" />
            <input value={f.search} placeholder="Search actions, actors, projects…" aria-label="Search the audit log" onChange={(e) => patch({ search: e.target.value })} />
          </div>
          <div className="mx-fac">
            <span className="eyebrow">Last 14 days</span>
            <div className="mx-strip sm">
              {strip.map((s) => (
                <button
                  key={s.day}
                  type="button"
                  className={'mx-sb' + (s.day === f.day ? ' on' : '') + (s.day === today ? ' now' : '')}
                  disabled={!s.n}
                  aria-pressed={s.day === f.day}
                  title={`${weekdayOf(s.day)} ${dWords(s.day, today)} · ${plural(s.n, 'event')}`}
                  aria-label={`${dWords(s.day, today)}: ${plural(s.n, 'event')}`}
                  onClick={(e) => onBar(s.day, e)}
                >
                  <i style={{ height: `${Math.max(3, (s.n / maxBar) * 40)}px` }} />
                  <span>{Number(s.day.slice(8))}</span>
                </button>
              ))}
            </div>
            {f.day ? (
              <button type="button" className="link" onClick={() => patch({ day: '' })}>
                {`Clear ${dWords(f.day, today)}`}
              </button>
            ) : (
              <span className="small">Click a bar to open the day · Shift-click to filter</span>
            )}
            {partial ? <span className="small">Counts cover the events loaded so far</span> : null}
          </div>
          <Facet<'all' | AuditActionCategory> title="Type" opts={typeOpts} cur={f.category} set={(k) => patch({ category: k })} />
          <Facet<WhoFilter> title="Who" opts={whoOpts} cur={f.role} set={(k) => patch({ role: k })} />
          <Btn cls="sm" ico="dl" disabled={!shown.length} title={`Download the ${plural(shown.length, 'event')} shown as a CSV file`} onClick={exportCsv}>
            Export CSV
          </Btn>
        </aside>
        <section className="glass mx-aspine" aria-label="Events">
          {body}
          {q.hasNextPage && shown.length ? (
            <button type="button" className="mx-showall" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage().catch(() => toast('Older events did not load · try again'))}>
              {q.isFetchingNextPage ? 'Loading older events…' : 'Load older events'}
            </button>
          ) : null}
        </section>
      </div>
    </>
  );
}

function Facet<T extends string>({ title, opts, cur, set }: { title: string; opts: Array<{ k: T; label: string; n: number; ico?: IconName }>; cur: T; set: (k: T) => void }) {
  return (
    <div className="mx-fac" role="group" aria-label={title}>
      <span className="eyebrow">{title}</span>
      {opts.map((o) => (
        <button key={o.k} type="button" className={'mx-facb' + (cur === o.k ? ' on' : '')} aria-pressed={cur === o.k} onClick={() => set(o.k)}>
          <span className="ins-fl">
            {o.ico ? <Icon name={o.ico} /> : null}
            {o.label}
          </span>
          <b>{o.n}</b>
        </button>
      ))}
    </div>
  );
}

function EventRow({
  ev,
  eng,
  project,
  showTarget,
  open,
  onToggle,
  base,
  go,
}: {
  ev: AuditEventRow;
  eng?: Engagement;
  project: string;
  showTarget: boolean;
  open: boolean;
  onToggle: () => void;
  base: string;
  go: (href: string) => void;
}) {
  const cat = getAuditActionCategory(ev.action);
  const label = formatAuditActionLabel(ev.action);
  const name = ev.actor_name?.trim();
  const email = ev.actor_email?.trim();
  const target = getAuditTargetType(ev.action);
  const when = stampLong(ev.created_at);
  let rel = '';
  try {
    rel = formatDistanceToNow(new Date(ev.created_at), { addSuffix: true });
  } catch {
    rel = '';
  }
  const facts = metadataFacts(ev.metadata);
  const links = eventLinks(ev, eng, base);
  return (
    <div className="mx-spe ins-spe">
      <span className="mx-spn" title={CATEGORY_LABELS[cat]}>
        <Icon name={CATEGORY_ICON[cat]} />
      </span>
      <div className="mx-dt">
        <div className="mx-spt">
          <b>
            {label}
            {showTarget && project ? <span className="mx-asub">{` · ${project}`}</span> : null}
          </b>
          <span className="mx-at" title={rel ? `${when} · ${rel}` : when}>
            {timeIst(ev.created_at)}
          </span>
        </div>
        {ev.summary && ev.summary !== label ? <span className="ins-asum">{ev.summary}</span> : null}
        <span className="mx-chips">
          <span title={name && email ? email : undefined}>{name || email || 'Unknown actor'}</span>
          <span className="pill mut sm" title="Their role when they did it">
            {roleLabel(ev.actor_role)}
          </span>
          {showTarget ? <span>{target}</span> : null}
          <button type="button" className="link" aria-expanded={open} onClick={onToggle}>
            {open ? 'Hide details' : 'Details'}
          </button>
        </span>
        {open ? (
          <div className="mx-adet ins-adet">
            <span className="mx-fact2">
              <small>When</small>
              <b>{rel ? `${when} · ${rel}` : when}</b>
            </span>
            {name && email ? (
              <span className="mx-fact2">
                <small>Email</small>
                <b>{email}</b>
              </span>
            ) : null}
            <span className="mx-fact2">
              <small>Target</small>
              <b>{project ? `${target} · ${project}` : target}</b>
            </span>
            {facts.map((x) => (
              <span key={x.k} className="mx-fact2">
                <small>{x.k}</small>
                <b>{x.v}</b>
              </span>
            ))}
            <span className="mx-fact2">
              <small>Action</small>
              <b className="ins-mono">{ev.action}</b>
            </span>
            {ev.engagement_id ? (
              <span className="mx-fact2">
                <small>Project id</small>
                <b className="ins-mono" title={ev.engagement_id}>{`${ev.engagement_id.slice(0, 8)}…`}</b>
              </span>
            ) : null}
            {links.map((l) => (
              <Btn key={l.label} cls="sm" ico={l.ico} onClick={() => go(l.href)}>
                {l.label}
              </Btn>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
