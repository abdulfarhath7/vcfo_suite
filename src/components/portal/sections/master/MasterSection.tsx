'use client';

/**
 * Master calendar (prototype body.txt MASTER CALENDAR + #mchelpm + a55_master.js):
 * go-live card, milestones, status mix, filters, the Gantt timeline by weeks,
 * the plan table, the minutes, and the task card popover.
 *
 * The prototype read a project-plan spreadsheet; our plan is the engagement's
 * own incorporation checklist with the windows SBC set on it — see
 * src/lib/client-portal/master-plan.ts for the mapping and the critical-path
 * rule. Minutes = the real timeline change requests on the engagement
 * (GET /api/engagements/:id/timeline-requests), and "Request a timeline change"
 * is the previous portal's flow (POST /api/client/change-requests, kind
 * 'timeline' → the Project Manager approves) in the new look.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TimelinePhaseDates, TimelineRequestDto } from '@/lib/client/client-home';
import {
  addPlanDays,
  buildMasterPlan,
  buildTimelineBlocks,
  cascadeBlocks,
  PLAN_STATUS_COLOR,
  PLAN_STATUS_LABEL,
  planDaysBetween,
  weekOf,
  type MasterPlan,
  type PlanRow,
  type PlanSide,
  type PlanStatus,
  type TimelineBlock,
} from '@/lib/client-portal/master-plan';
import { usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { getJson, PK, sendJson, useMyEngagement, usePortalIncorporation, useRefreshPortal } from '../../data';
import { daysTo, fmt, fmtStamp, fmtY, MON, P, rel, todayIso } from '../../dates';
import { ModalBox, PopHead } from '../../overlays';
import { Btn, Icon, Pill, SecHead, SecLoading, Seg } from '../../ui';
import { useStepActions } from '../incorporation/actions';
import '../../css/95-master.css';

type View = 'timeline' | 'table' | 'minutes';
type SideFilter = 'all' | 'sbc' | 'client';

const WKW = 40;
const PXD = WKW / 7;
const MIX_ORDER: PlanStatus[] = ['done', 'wip', 'over', 'todo', 'na'];

/* ---------------------------------------------------------------- data */

function useMasterPlan(): { plan: MasterPlan; today: string; loading: boolean } {
  const { model, loading, engagement } = usePortalIncorporation();
  const today = todayIso();
  // while SBC has set no dates, project the plan from the playbook (master-plan.ts projectedWindow)
  const start = engagement?.createdAt?.slice(0, 10);
  const inc = engagement?.incorporationDate ?? null;
  const plan = useMemo(() => buildMasterPlan(model, today, start ? { start, incorporationDate: inc } : undefined), [model, today, start, inc]);
  return { plan, today, loading };
}

const QK_TL = (id: string) => [PK, 'timeline-requests', id] as const;

function useTimelineRequests(engagementId: string | undefined) {
  return useQuery({
    queryKey: QK_TL(engagementId ?? ''),
    queryFn: async () => (await getJson<{ requests: TimelineRequestDto[] }>(`/api/engagements/${encodeURIComponent(engagementId!)}/timeline-requests`))?.requests ?? [],
    enabled: Boolean(engagementId),
    staleTime: 30_000,
  });
}

function sideLabel(side: PlanSide, short: string): string {
  return side === 'client' ? short : side === 'mca' ? 'MCA' : 'SBC';
}

/* ---------------------------------------------------------------- section */

export function MasterSection() {
  const { shell, openModal, openPop } = usePortal();
  const { plan, today, loading } = useMasterPlan();
  const { engagement } = useMyEngagement();
  const short = shell?.companyShort || 'you';
  const [view, setView] = useState<View>('timeline');
  const [ws, setWs] = useState<number | 'all'>('all');
  const [st, setSt] = useState<PlanStatus | null>(null);
  const [side, setSide] = useState<SideFilter>('all');
  const [crit, setCrit] = useState(false);
  const [open, setOpen] = useState<Set<number> | null>(null);

  const openSet = useMemo(() => {
    if (open) return open;
    // default: open the workstream that is in progress (first with an open deliverable), else the first dated one
    const act = plan.workstreams.find((w) => w.rows.some((r) => r.status === 'wip' || r.status === 'over'));
    const first = act ?? plan.workstreams.find((w) => w.dated > 0) ?? plan.workstreams[0];
    return new Set(first ? [first.no] : []);
  }, [open, plan.workstreams]);

  const vis = useCallback(
    (r: PlanRow) =>
      (ws === 'all' || r.wsNo === ws) &&
      (!st || r.status === st) &&
      (side === 'all' || (side === 'client' ? r.side === 'client' : r.side !== 'client')) &&
      (!crit || r.critical),
    [ws, st, side, crit],
  );

  const openTask = useCallback((id: string, anchor?: Element | null) => openPop(anchor ?? null, <TaskCard id={id} />, { kind: 'task' }), [openPop]);

  const requestChange = useCallback(() => openModal(<TimelineRequestModal />, { label: 'Request a timeline change' }), [openModal]);

  const palette = useMemo<PaletteItem[]>(
    () =>
      plan.hasSchedule
        ? [{ id: 'master:request', label: 'Request a timeline change', kind: 'Master calendar', sw: 'var(--ice)', go: requestChange }]
        : [],
    [plan.hasSchedule, requestChange],
  );
  usePaletteItems('master', palette);

  if (loading && plan.rows.length === 0) {
    return (
      <>
        <SecHead title="Master calendar" />
        <SecLoading />
      </>
    );
  }

  if (!plan.hasSchedule && !plan.projected) {
    return (
      <>
        <SecHead title="Master calendar" />
        <section className="glass panel">
          <div className="sec-empty">
            Your master calendar appears once SBC sets the dates for {shell?.companyShort ? `${shell.companyShort}’s` : 'your'} plan. Until then the steps themselves are in Incorporation and Registrations.
          </div>
        </section>
      </>
    );
  }

  const start = plan.start!;
  const curW = Math.max(1, Math.min(plan.weeks, weekOf(start, today)));
  const pool = plan.rows.filter((r) => ws === 'all' || r.wsNo === ws);
  const by = (s: PlanStatus) => pool.filter((r) => r.status === s).length;
  const allOpen = plan.workstreams.every((w) => openSet.has(w.no));

  return (
    <>
      <SecHead title="Master calendar" count={`Week ${curW} of ${plan.weeks} · ${plan.rows.length} deliverables`}>
        <Btn cls="sm" ico="help" onClick={() => openModal(<HelpModal plan={plan} short={short} />, { label: 'How to read the master calendar' })}>
          How to read
        </Btn>
        <Seg<View>
          value={view}
          onChange={setView}
          ariaLabel="View"
          options={[
            { value: 'timeline', label: (<><Icon name="gantt" size={15} />Timeline</>) },
            { value: 'table', label: (<><Icon name="grid" size={15} />Plan</>) },
            { value: 'minutes', label: (<><Icon name="notes" size={15} />Minutes</>) },
          ]}
        />
      </SecHead>

      {plan.projected ? (
        <div className="banner info" style={{ margin: '0 0 14px' }}>
          <Icon name="gantt" />
          <div>
            <b>Projected from SBC’s playbook</b>
            <span>
              SBC has not set the dates for {short === 'you' ? 'your' : `${short}’s`} plan yet, so these bars use SBC’s standard timeline for each step: the
              expected weeks from the project start for SPICe+, and the statutory limit from incorporation for the steps that have one. Dashed bars are
              estimates; your project manager sets the actual dates. Done steps show the day they were really done.
            </span>
          </div>
        </div>
      ) : null}

      <div className="mc-top">
        <section className="glass mc-golive">
          <span className="eyebrow">
            {plan.projected ? 'Go-live · projected' : plan.goLiveFrom === 'coi' ? 'Go-live · expected incorporation' : 'Go-live · last planned date'}
          </span>
          <div className="gl-big">
            <b>{plan.goLive ? fmtY(plan.goLive) : '—'}</b>
            {plan.goLive ? <span>{rel(daysTo(plan.goLive, today))}</span> : null}
          </div>
          <div className="wkbar" aria-label={`Week ${curW} of ${plan.weeks}`}>
            {Array.from({ length: plan.weeks }, (_, i) => {
              const w = i + 1;
              const ms = plan.milestones.some((m) => weekOf(start, m.date) === w);
              return <i key={w} className={w < curW ? 'd' : w === curW ? 'n' : ms ? 'm' : ''} title={`W${w} · ${fmt(addPlanDays(start, i * 7))}`} />;
            })}
          </div>
          <div className="small" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>W1 · {fmt(start)}</span>
            <span>W{curW} now</span>
            <span>
              W{plan.weeks} · {fmt(plan.axisEnd!)}
            </span>
          </div>
        </section>

        <section className="glass mc-miles">
          <span className="eyebrow">Milestones</span>
          {plan.milestones.map((m) => {
            const list = plan.workstreams.find((w) => w.no === m.wsNo)!.rows.filter((r) => r.status !== 'na');
            const n = (s: PlanStatus) => list.filter((r) => r.status === s).length;
            return (
              <div key={m.wsNo} className="ms">
                <span className="dia" style={m.wsNo === 4 ? { background: 'var(--ink-3)' } : undefined} />
                <b>{m.name}</b>
                <span className="dt">
                  {m.done}/{m.total} · {fmt(m.date)}
                </span>
                <div className="pb">
                  {(['done', 'wip', 'over', 'todo'] as PlanStatus[]).map((s) => (
                    <i key={s} style={{ flex: n(s), background: PLAN_STATUS_COLOR[s] }} />
                  ))}
                </div>
              </div>
            );
          })}
          {plan.workstreams.filter((w) => !w.end).length ? (
            <p className="small" style={{ marginTop: 8 }}>
              {plan.workstreams
                .filter((w) => !w.end)
                .map((w) => w.name)
                .join(', ')}
              : no planned dates yet.
            </p>
          ) : null}
        </section>

        <section className="glass mc-mix">
          <span className="eyebrow">{ws === 'all' ? 'All workstreams' : plan.workstreams.find((w) => w.no === ws)?.name}</span>
          <div className="mixbar">
            {MIX_ORDER.map((s) => (
              <i key={s} style={{ flex: by(s), background: PLAN_STATUS_COLOR[s] }} />
            ))}
          </div>
          <div className="mixleg">
            {(['done', 'wip', 'over', 'todo'] as PlanStatus[]).map((s) => (
              <button key={s} type="button" aria-pressed={st === s} onClick={() => setSt(st === s ? null : s)}>
                <i style={{ background: PLAN_STATUS_COLOR[s] }} />
                {PLAN_STATUS_LABEL[s]}
                <b>{by(s)}</b>
              </button>
            ))}
          </div>
        </section>
      </div>

      {view !== 'minutes' ? (
        <div className="glass mc-filters">
          <select aria-label="Workstream" value={ws === 'all' ? 'all' : String(ws)} onChange={(e) => setWs(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All workstreams</option>
            {plan.workstreams.map((w) => (
              <option key={w.no} value={w.no}>
                {w.name} ({w.rows.length})
              </option>
            ))}
          </select>
          <Seg<SideFilter>
            value={side}
            onChange={setSide}
            ariaLabel="Side"
            options={[
              { value: 'all', label: 'Everyone' },
              { value: 'sbc', label: 'SBC' },
              { value: 'client', label: short },
            ]}
          />
          <button type="button" className="crit" aria-pressed={crit} onClick={() => setCrit((c) => !c)}>
            <Icon name="bolt" />
            Critical path
          </button>
          <span className="sp" />
          {view === 'timeline' ? (
            <Btn cls="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(plan.workstreams.map((w) => w.no)))}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Btn>
          ) : null}
        </div>
      ) : null}

      {view === 'timeline' ? (
        <section className="glass mc-body">
          <Gantt plan={plan} today={today} vis={vis} openSet={openSet} short={short} onToggle={(no) => setOpen((o) => { const n = new Set(o ?? openSet); if (n.has(no)) n.delete(no); else n.add(no); return n; })} onTask={openTask} />
        </section>
      ) : view === 'table' ? (
        <section className="glass mc-body">
          <PlanTable plan={plan} vis={vis} short={short} onTask={openTask} />
        </section>
      ) : (
        <section className="glass mc-body">
          <Minutes engagementId={engagement?.id} onRequest={requestChange} />
        </section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- gantt */

function Gantt({
  plan,
  today,
  vis,
  openSet,
  short,
  onToggle,
  onTask,
}: {
  plan: MasterPlan;
  today: string;
  vis: (r: PlanRow) => boolean;
  openSet: Set<number>;
  short: string;
  onToggle: (no: number) => void;
  onTask: (id: string, anchor?: Element | null) => void;
}) {
  const start = plan.start!;
  const W = plan.weeks * WKW;
  const xOf = (d: string) => planDaysBetween(start, d) * PXD;
  const ref = useRef<HTMLDivElement>(null);
  const tx = Math.min(Math.max(0, xOf(today)), W);
  const curW = weekOf(start, today);

  useEffect(() => {
    const g = ref.current;
    if (g) g.scrollLeft = Math.max(0, tx - 3 * WKW);
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // month labels along the header
  const months: { x: number; text: string }[] = [];
  {
    const s = P(start);
    months.push({ x: 0, text: `${MON[s.getUTCMonth()]} ${s.getUTCFullYear()}` });
    let m = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
    const end = P(plan.axisEnd!);
    while (m < end) {
      const d = m.toISOString().slice(0, 10);
      months.push({ x: xOf(d), text: m.getUTCMonth() === 0 ? `${MON[0]} ${m.getUTCFullYear()}` : MON[m.getUTCMonth()]! });
      m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
    }
  }

  let shown = 0;
  return (
    <div ref={ref} className="gantt fadein" style={{ '--gw': `${W}px`, '--wk': `${WKW}px` } as CSSProperties}>
      <div style={{ position: 'relative', width: 'max-content', minWidth: '100%' }}>
        <div className="g-row g-head">
          <div className="g-n">DELIVERABLE</div>
          <div className="g-tr">
            {months.map((m, i) => (
              <span key={i} className="g-mon" style={{ left: m.x, borderLeft: i === 0 ? 0 : undefined }}>
                {m.text}
              </span>
            ))}
            {Array.from({ length: plan.weeks }, (_, i) => (
              <span key={i} className={'g-wk' + (i + 1 === curW ? ' now' : '')} style={{ left: i * WKW }} title={`Week ${i + 1} · ${fmt(addPlanDays(start, i * 7))}`}>
                W{i + 1}
              </span>
            ))}
          </div>
        </div>
        <div className="g-row">
          <div className="g-n" style={{ font: '700 12px var(--f-disp)', color: 'var(--due-ink)' }}>
            <span className="dia" style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: 'var(--due)', borderRadius: 2, flex: 'none' }} />
            Milestones
          </div>
          <div className="g-tr">
            {plan.milestones.map((m) => (
              <span key={m.wsNo}>
                <span className="ms-dia" style={{ left: xOf(m.date) + PXD }} title={`${m.name} · ${fmtY(m.date)}`} />
                <span className="ms-lbl" style={{ left: xOf(m.date) + PXD + 12 }}>
                  {m.name}
                </span>
              </span>
            ))}
            {plan.goLive ? <span className="ms-dia" style={{ left: xOf(plan.goLive), background: 'var(--ice)' }} title={`Go-live · ${fmtY(plan.goLive)}`} /> : null}
          </div>
        </div>
        {plan.workstreams.map((w) => {
          const list = w.rows.filter(vis);
          if (!list.length) return null;
          shown += list.length;
          const isOpen = openSet.has(w.no);
          const dated = list.filter((r) => r.start && r.end);
          const a = dated.map((r) => r.start!).sort()[0];
          const b = dated.map((r) => r.end!).sort().at(-1);
          const n = (s: PlanStatus) => list.filter((r) => r.status === s).length;
          return (
            <div key={w.no}>
              <div className="g-row g-grp" aria-expanded={isOpen}>
                <button type="button" className="g-n" onClick={() => onToggle(w.no)}>
                  <Icon name="down" className="cv" />
                  <span className="t">{w.name}</span>
                  {n('over') ? (
                    <span className="pill" style={{ padding: '2px 7px', fontSize: 10.5, background: 'color-mix(in srgb, var(--mc-over) 18%, transparent)', color: 'var(--mc-over)' }}>
                      {n('over')} overdue
                    </span>
                  ) : null}
                  <em>
                    {n('done')}/{list.length}
                  </em>
                </button>
                <div className="g-tr">
                  {a && b ? (
                    <span className="gbar sum" style={{ left: xOf(a), width: Math.max(8, xOf(b) - xOf(a) + PXD) }} title={`${w.name}: ${n('done')} of ${list.length} completed`}>
                      {MIX_ORDER.map((s) => (
                        <i key={s} style={{ width: `${(n(s) / list.length) * 100}%`, background: PLAN_STATUS_COLOR[s], float: 'left' }} />
                      ))}
                    </span>
                  ) : (
                    <span className="nodates">no planned dates</span>
                  )}
                </div>
              </div>
              {isOpen
                ? list.map((r) => {
                    const left = r.start ? xOf(r.start) : 0;
                    const width = r.start && r.end ? Math.max(10, xOf(r.end) - left + PXD) : 0;
                    return (
                      <div key={r.id} className="g-row">
                        <button type="button" className="g-n" title={r.title} onClick={(e) => onTask(r.id, e.currentTarget)}>
                          <span className="t">{r.title}</span>
                          {!r.start ? <em style={{ fontStyle: 'normal', font: '600 10.5px var(--f-disp)', color: 'var(--ink-3)', flex: 'none' }}>no dates</em> : null}
                          <span className={'own' + (r.side === 'client' ? ' nw' : '')}>{sideLabel(r.side, short).slice(0, 8)}</span>
                        </button>
                        <div className="g-tr">
                          {r.start && r.end ? (
                            <span
                              className={'gbar s-' + r.status}
                              role="button"
                              tabIndex={0}
                              style={
                                r.projected
                                  ? { left, width, backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 5px, rgba(0,0,0,.22) 5px 7px)', outline: '1px dashed currentColor', outlineOffset: -1 }
                                  : { left, width }
                              }
                              title={`${r.title} · ${PLAN_STATUS_LABEL[r.status]} · ${fmt(r.start)} → ${fmt(r.end)}${r.projected ? ' · projected from SBC’s playbook' : ''}`}
                              onClick={(e) => onTask(r.id, e.currentTarget)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') onTask(r.id, e.currentTarget);
                              }}
                            >
                              {r.critical ? <Icon name="bolt" /> : null}
                              {width > 64 ? <span>{r.status === 'done' ? (r.actual ? `✓ ${fmt(r.actual)}` : '✓') : `${r.days}d`}</span> : null}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>
          );
        })}
        {!shown ? (
          <p className="small" style={{ padding: 24 }}>
            No deliverables match these filters.
          </p>
        ) : null}
        <div className="g-today" style={{ left: `calc(var(--gn) + ${tx}px)` }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- table */

function PlanTable({ plan, vis, short, onTask }: { plan: MasterPlan; vis: (r: PlanRow) => boolean; short: string; onTask: (id: string, anchor?: Element | null) => void }) {
  const start = plan.start!;
  return (
    <div className="gantt fadein">
      <table className="mtab">
        <thead>
          <tr>
            {['DELIVERABLE', 'STATUS', 'DAYS', 'START', 'END', 'DONE ON', 'SCHEDULE', 'WEEKS', 'MILESTONE', 'OWNER', 'DEPENDENCY'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.workstreams.map((w) => {
            const list = w.rows.filter(vis);
            if (!list.length) return null;
            return (
              <WsRows key={w.no} name={w.name} list={list} start={start} short={short} onTask={onTask} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WsRows({ name, list, start, short, onTask }: { name: string; list: PlanRow[]; start: string; short: string; onTask: (id: string, anchor?: Element | null) => void }) {
  return (
    <>
      <tr className="g">
        <td colSpan={11}>
          {name} · {list.length}
        </td>
      </tr>
      {list.map((r) => (
        <tr key={r.id} className="r" onClick={(e) => onTask(r.id, e.currentTarget)}>
          <td style={{ minWidth: 260 }}>
            <div style={{ fontWeight: 600 }}>{r.title}</div>
            {r.critical ? (
              <span className="small" style={{ color: 'var(--due-ink)' }}>
                ⚡ critical path
              </span>
            ) : null}
          </td>
          <td>
            <span className="sdot">
              <i style={{ background: PLAN_STATUS_COLOR[r.status] }} />
              {PLAN_STATUS_LABEL[r.status]}
            </span>
            <div className="small">{r.raw}</div>
          </td>
          <td className="num">{r.days ?? '—'}</td>
          <td className="num" style={{ whiteSpace: 'nowrap' }}>{r.start ? fmt(r.start) : <span className="small">no planned dates</span>}</td>
          <td className="num" style={{ whiteSpace: 'nowrap' }}>{r.end ? fmt(r.end) : '—'}</td>
          <td className="num" style={{ whiteSpace: 'nowrap' }}>{r.actual ? fmt(r.actual) : '—'}</td>
          <td>{r.schedule ? <span className={'sch ' + r.schedule.replace(/\s/g, '')}>{r.schedule}</span> : '—'}</td>
          <td className="num" style={{ whiteSpace: 'nowrap' }}>{r.start && r.end ? `W${weekOf(start, r.start)}–W${weekOf(start, r.end)}` : '—'}</td>
          <td>{r.milestone}</td>
          <td>{sideLabel(r.side, short)}</td>
          <td className="small" style={{ maxWidth: 280 }}>{r.dependsOn ? `After: ${r.dependsOn}` : ''}</td>
        </tr>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- task card */

function TaskCard({ id }: { id: string }) {
  const { shell, closePop } = usePortal();
  const { plan } = useMasterPlan();
  const { openStepWizard } = useStepActions();
  const short = shell?.companyShort || 'you';
  const t = plan.rows.find((r) => r.id === id);
  if (!t) return <PopHead title="Deliverable" sub="No longer on the plan" />;
  const start = plan.start!;
  return (
    <div>
      <PopHead title={t.title} sub={t.ws} />
      <div className="fc-chips" style={{ marginTop: 10 }}>
        <span className="pill" style={{ background: `color-mix(in srgb, ${PLAN_STATUS_COLOR[t.status]} 18%, transparent)`, color: PLAN_STATUS_COLOR[t.status] }}>
          {PLAN_STATUS_LABEL[t.status]}
        </span>
        <Pill kind="mut">{t.raw}</Pill>
        {t.schedule ? <span className={'sch ' + t.schedule.replace(/\s/g, '')}>{t.schedule}</span> : null}
        {t.critical ? (
          <Pill kind="due" icon="bolt">
            Critical path
          </Pill>
        ) : null}
      </div>
      <div className="fc-grid">
        <div>
          <span>PLANNED</span>
          <b>{t.start && t.end ? `${fmt(t.start)} → ${fmt(t.end)}` : 'No planned dates'}</b>
        </div>
        <div>
          <span>WEEKS</span>
          <b>{t.start && t.end ? `W${weekOf(start, t.start)} → W${weekOf(start, t.end)} · ${t.days} days` : '—'}</b>
        </div>
        <div>
          <span>COMPLETED</span>
          <b>{t.actual ? fmtY(t.actual) : '—'}</b>
        </div>
        <div>
          <span>OWNER</span>
          <b>{sideLabel(t.side, short)}</b>
        </div>
        <div>
          <span>WORKSTREAM</span>
          <b>{t.ws}</b>
        </div>
        <div>
          <span>MILESTONE</span>
          <b>{t.milestone}</b>
        </div>
      </div>
      {t.dependsOn ? (
        <div className="fc-now">
          <b>Depends on: </b>
          {t.dependsOn}
        </div>
      ) : null}
      {t.status === 'over' ? (
        <div className="fc-now">
          <b>Late: </b>
          {t.lateDays} day{t.lateDays === 1 ? '' : 's'} past its planned end
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Btn cls="sm pri" ico="step" onClick={() => { closePop(); openStepWizard(t.id); }}>
          Open the step
        </Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- minutes (timeline change requests) */

const REQ_STATUS: Record<TimelineRequestDto['status'], { pill: 'due' | 'ok' | 'over' | 'mut'; label: string; next: string }> = {
  pending: { pill: 'due', label: 'Pending', next: 'approves or declines it. Your dates stay as they are until then.' },
  approved: { pill: 'ok', label: 'Approved', next: 'approved it — the dates on this calendar are the new ones.' },
  rejected: { pill: 'over', label: 'Declined', next: 'declined it — the dates stay as planned.' },
  withdrawn: { pill: 'mut', label: 'Withdrawn', next: 'nothing further — the request was withdrawn.' },
};

function Minutes({ engagementId, onRequest }: { engagementId: string | undefined; onRequest: () => void }) {
  const { shell, toast } = usePortal();
  const qc = useQueryClient();
  const refresh = useRefreshPortal();
  const q = useTimelineRequests(engagementId);
  const manager = shell?.team.find((t) => t.role === 'Project Manager')?.name ?? 'Your project manager';
  const [busy, setBusy] = useState<string | null>(null);
  const withdraw = async (id: string) => {
    setBusy(id);
    try {
      await sendJson(`/api/client/change-requests/${encodeURIComponent(id)}`, 'DELETE');
      toast('Request withdrawn');
      void qc.invalidateQueries({ queryKey: QK_TL(engagementId ?? '') });
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not withdraw the request');
    } finally {
      setBusy(null);
    }
  };
  const list = q.data ?? [];
  return (
    <div className="mins fadein">
      <div className="min">
        <div className="mh">
          <Pill kind="up">Timeline</Pill>
          <span className="small" style={{ marginLeft: 'auto' }}>
            {manager} · Project Manager
          </span>
        </div>
        <b>Need the plan to move?</b>
        <p>Propose new dates for the incorporation phases and say why. {manager} approves the request; the calendar changes only then.</p>
        <div className="nx">
          <Btn cls="pri sm" ico="cal" onClick={onRequest}>
            Request a timeline change
          </Btn>
        </div>
      </div>
      {q.isPending ? <div className="min small">Loading the request history…</div> : null}
      {!q.isPending && !list.length ? (
        <div className="min">
          <b>No timeline changes requested yet</b>
          <p>Every request, its reason and the manager’s decision will be minuted here.</p>
        </div>
      ) : null}
      {list.map((r) => {
        const st = REQ_STATUS[r.status] ?? REQ_STATUS.pending;
        return (
          <div key={r.id} className="min">
            <div className="mh">
              <Pill kind={st.pill}>{st.label}</Pill>
              <span className="small" style={{ marginLeft: 'auto' }}>
                {fmtStamp(r.createdAt)}
              </span>
            </div>
            <b>
              Timeline change{r.requestedByName ? ` · ${r.requestedByName}` : ''}
              {r.slipDays ? ` · COI ${r.slipDays > 0 ? '+' : ''}${r.slipDays} days` : ''}
            </b>
            <p>{r.reason}</p>
            {r.phases.length ? (
              <p className="small" style={{ marginTop: 6 }}>
                {r.phases.map((p) => `${p.name}: ${p.from === p.to ? fmt(p.from) : `${fmt(p.from)} – ${fmt(p.to)}`}`).join(' · ')}
              </p>
            ) : null}
            <div className="nx">
              <strong>NEXT STEP · {manager.toUpperCase()}</strong>
              {manager} {st.next}
              {r.status === 'pending' ? (
                <div style={{ marginTop: 8 }}>
                  <Btn cls="sm" ico="x" disabled={busy === r.id} onClick={() => void withdraw(r.id)}>
                    Withdraw
                  </Btn>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineRequestModal() {
  const { shell, toast, closeModal } = usePortal();
  const { model, engagement } = usePortalIncorporation();
  const qc = useQueryClient();
  const refresh = useRefreshPortal();
  const base = useMemo(() => buildTimelineBlocks(model, engagement?.incorporationDate), [model, engagement?.incorporationDate]);
  const [blocks, setBlocks] = useState<TimelineBlock[] | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = blocks ?? base;
  const manager = shell?.team.find((t) => t.role === 'Project Manager')?.name ?? 'the project manager';
  const company = shell?.companyShort ?? 'your company';

  if (!base || !cur) {
    return (
      <ModalBox title="Request a timeline change" sub="The phases can be moved once SBC has set the incorporation window.">
        <div className="mfoot">
          <Btn cls="pri" onClick={closeModal}>
            Got it
          </Btn>
        </div>
      </ModalBox>
    );
  }

  const edit = (i: number, from: string, to: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
    setBlocks(cascadeBlocks(cur, i, from, to));
  };
  const changed = cur.some((b, i) => b.from !== base[i]!.from || b.to !== base[i]!.to);
  const slip = planDaysBetween(base[3]!.from, cur[3]!.from);
  const range = (b: TimelineBlock) => (b.milestone ? fmtY(b.from) : `${fmt(b.from)} – ${fmtY(b.to)}`);

  const send = async () => {
    if (!changed) {
      toast('No changes to send');
      return;
    }
    if (!reason.trim()) {
      setErr(true);
      return;
    }
    setBusy(true);
    try {
      const phases: TimelinePhaseDates[] = cur.map((b) => ({ id: b.id, name: b.name, from: b.from, to: b.to }));
      await sendJson('/api/client/change-requests', 'POST', { kind: 'timeline', engagementId: engagement?.id, note: reason.trim(), phases, coiBefore: base[3]!.from });
      closeModal();
      toast(`Change request sent to ${manager}`);
      void qc.invalidateQueries({ queryKey: QK_TL(engagement?.id ?? '') });
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the request. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBox title="Request a timeline change" sub={`Propose new dates. Later phases move with the one before them; ${company}’s dates stay as they are until ${manager} approves.`} width={680}>
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {cur.map((b, i) => {
          const b0 = base[i]!;
          const dd = planDaysBetween(b0.to, b.to);
          return (
            <div key={b.id} className="mc-req-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <b style={{ font: '600 13.5px var(--f-disp)' }}>
                  {b.done ? '🔒 ' : ''}
                  {b.name}
                </b>
                <div className="small">
                  {range(b0)}
                  {dd ? <span className={'sch ' + (dd > 0 ? 'Delayed' : 'Ontrack')} style={{ marginLeft: 8 }}>{`${dd > 0 ? '+' : ''}${dd} d`}</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flex: '0 1 auto' }}>
                <input className="rin" type="date" aria-label={`${b.name} start`} value={b.from} disabled={b.done} min={i > 0 ? cur[i - 1]!.to : undefined} onChange={(e) => edit(i, e.target.value, b.milestone ? e.target.value : b.to)} style={{ width: 150 }} />
                {!b.milestone ? <input className="rin" type="date" aria-label={`${b.name} end`} value={b.to} disabled={b.done} min={b.from} onChange={(e) => edit(i, b.from, e.target.value)} style={{ width: 150 }} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="fc-chips" style={{ marginTop: 12 }}>
        <Pill kind="mut">
          COI {fmtY(base[3]!.from)}
          {slip ? ` → ${fmtY(cur[3]!.from)}` : ''}
        </Pill>
        <Pill kind={slip > 0 ? 'over' : slip < 0 ? 'ok' : 'mut'}>{slip > 0 ? `Slipped by ${slip} day${slip > 1 ? 's' : ''}` : slip < 0 ? `Pulled in by ${-slip} day${slip < -1 ? 's' : ''}` : 'No change to the COI date'}</Pill>
      </div>
      <label htmlFor="mc-reason" className="small" style={{ display: 'block', marginTop: 14 }}>
        Why do you need this change?
      </label>
      <textarea
        id="mc-reason"
        className="rin"
        rows={3}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (e.target.value.trim()) setErr(false);
        }}
        placeholder="For example: our director is travelling until 14 Oct, so the KYC video call has to move."
        style={{ marginTop: 6, resize: 'vertical' }}
      />
      {err ? (
        <div className="small" role="alert" style={{ color: 'var(--over-ink)', marginTop: 6 }}>
          Add a short reason so {manager} can approve it.
        </div>
      ) : null}
      <div className="mfoot">
        <span className="small" style={{ marginRight: 'auto' }}>
          {manager} (Project Manager) approves requests.
        </span>
        <Btn onClick={closeModal}>Cancel</Btn>
        <Btn cls="pri" ico="send" disabled={busy || !changed} onClick={() => void send()}>
          Send request
        </Btn>
      </div>
    </ModalBox>
  );
}

/* ---------------------------------------------------------------- help */

function HelpModal({ plan, short }: { plan: MasterPlan; short: string }) {
  return (
    <ModalBox title="How to read the master calendar" width={680}>
      <div style={{ marginTop: 10 }}>
        <div className="hrow">
          <svg viewBox="0 0 34 34">
            <rect x="3" y="12" width="28" height="10" rx="4" style={{ fill: 'var(--mc-wip)' }} />
          </svg>
          <div>
            <b>Every bar is one deliverable.</b>
            <span>
              It starts on its planned start date and ends on its planned end date — the window SBC set for the step. Columns are weeks: W1 is {fmtY(plan.start!)}, W{plan.weeks} is {fmtY(plan.axisEnd!)}. A step with no window yet has no bar.
            </span>
          </div>
        </div>
        <div className="hrow">
          <svg viewBox="0 0 34 34">
            <rect x="2" y="5" width="13" height="10" rx="3" style={{ fill: 'var(--mc-done)' }} />
            <rect x="19" y="5" width="13" height="10" rx="3" style={{ fill: 'var(--mc-wip)' }} />
            <rect x="2" y="19" width="13" height="10" rx="3" style={{ fill: 'var(--mc-todo)' }} />
            <rect x="19" y="19" width="13" height="10" rx="3" style={{ fill: 'var(--mc-over)' }} />
          </svg>
          <div>
            <b>The colour is its status.</b>
            <span>Navy: completed. Green: work in progress. Yellow: yet to begin. Orange: overdue, its end date has passed and it is not done. A dashed outline means not applicable.</span>
          </div>
        </div>
        <div className="hrow">
          <svg viewBox="0 0 34 34">
            <line x1="17" y1="2" x2="17" y2="32" style={{ stroke: 'var(--ice)' }} strokeWidth="3" />
          </svg>
          <div>
            <b>The bright line is today.</b>
            <span>Bars to its left should be navy. Anything orange to its left is late.</span>
          </div>
        </div>
        <div className="hrow">
          <svg viewBox="0 0 34 34">
            <rect x="10" y="10" width="14" height="14" rx="2" transform="rotate(45 17 17)" style={{ fill: 'var(--due)' }} />
          </svg>
          <div>
            <b>Diamonds are milestones.</b>
            <span>One per workstream, on the last planned end date of its steps. The blue diamond is go-live{plan.goLiveFrom === 'coi' ? ', the expected Certificate of Incorporation' : ''}.</span>
          </div>
        </div>
        <div className="hrow">
          <svg viewBox="0 0 34 34">
            <path d="M19 3 8 19h8l-2 12 12-17h-8z" style={{ fill: 'var(--due)' }} />
          </svg>
          <div>
            <b>⚡ marks the critical path.</b>
            <span>The step open right now and the last window in each workstream: if one of these slips, the milestone slips. Use the Critical path filter to see only these.</span>
          </div>
        </div>
        <div className="hrow">
          <svg viewBox="0 0 34 34">
            <rect x="3" y="9" width="12" height="16" rx="4" style={{ fill: 'var(--hi)', stroke: 'var(--line)' }} />
            <rect x="19" y="9" width="12" height="16" rx="4" style={{ fill: 'var(--due-bg)' }} />
          </svg>
          <div>
            <b>SBC or {short} shows who owns it.</b>
            <span>{short} items wait on your team. Filter by side to see your own list.</span>
          </div>
        </div>
        <div className="hrow">
          <svg viewBox="0 0 34 34">
            <path d="M8 12l9 9 9-9" fill="none" style={{ stroke: 'var(--ink-2)' }} strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div>
            <b>Rows group by workstream.</b>
            <span>A collapsed workstream shows one summary bar, coloured by how much of it is done. Click its name to open it; click any bar for the full detail.</span>
          </div>
        </div>
      </div>
      <div className="mfoot">
        <button type="button" className="btn pri" data-close>
          Got it
        </button>
      </div>
    </ModalBox>
  );
}
