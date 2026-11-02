'use client';

/**
 * Incorporation runway (prototype mxRunway — phase progress, the timeline's
 * phase bars, days to COI and stuck steps in one panel), one row per
 * incorporating client.
 *
 * Bars use real dates only: the manager's schedule windows where set,
 * otherwise the days the phase's steps were actually done (an open phase runs
 * to today). A phase with neither has no bar. The COI target is the manager's
 * incorporation window end; without one the row says "Not set".
 */
import type { CSSProperties } from 'react';
import { SecLoading } from '@/components/portal/ui';

import { Icon, Panel } from '../../ui';
import { useConsole } from '../../runtime';
import { CAv, CDot } from './bits';
import { stepPath, addDays, daysBetween, dShort, isoWeek, phaseSpan, plural, stepCode, weekOf, type PhaseSpan, type TClient, type TodayModel } from './model';

const PHASE_KEY = ['P1', 'P2', 'P3', 'P4'];

interface Row {
  c: TClient;
  spans: Array<PhaseSpan | undefined>;
  stuckPhase: number;
}

export function Runway({ m, loading }: { m: TodayModel; loading: boolean }) {
  const { go, base } = useConsole();
  const inc = m.clients.filter((c) => c.stage === 'inc');

  const rows: Row[] = inc
    .map((c) => {
      const created = c.e.createdAt.slice(0, 10);
      let prevEnd: string | undefined;
      const spans = c.model.phases.slice(0, 2).map((p) => {
        const s = phaseSpan(p, prevEnd, created, m.today);
        if (s) prevEnd = s.end;
        return s;
      });
      return { c, spans, stuckPhase: c.late && c.current ? c.current.phaseNo - 1 : -1 };
    })
    .sort(
      (a, b) =>
        Number(b.c.late) - Number(a.c.late) ||
        (a.c.coiDays ?? 9999) - (b.c.coiDays ?? 9999) ||
        a.c.short.localeCompare(b.c.short),
    );

  /* the axis: whole weeks around today, wide enough for every bar and target, at most 16 */
  const dates = [m.today, ...rows.flatMap((r) => r.spans.flatMap((s) => (s ? [s.start, s.end] : []))), ...inc.flatMap((c) => (c.coi ? [c.coi] : []))];
  let from = weekOf(dates.reduce((a, b) => (a < b ? a : b), addDays(m.today, -14)))[0]!;
  let to = dates.reduce((a, b) => (a > b ? a : b), addDays(m.today, 28));
  let weeks = Math.min(16, Math.max(8, Math.ceil((daysBetween(from, to) + 1) / 7)));
  if (daysBetween(from, to) > 16 * 7) {
    from = addDays(weekOf(m.today)[0]!, -8 * 7);
    weeks = 16;
  }
  to = addDays(from, weeks * 7);
  const span = weeks * 7;
  const pct = (d: string) => Math.max(0, Math.min(100, (daysBetween(from, d) / span) * 100));
  const ticks = Array.from({ length: weeks + 1 }, (_, i) => addDays(from, i * 7));
  const nowWeek = weekOf(m.today)[0];

  const near = inc
    .filter((c) => c.coi)
    .sort((a, b) => (a.coiDays ?? 0) - (b.coiDays ?? 0))
    .slice(0, 4);

  return (
    <Panel
      id="mx-runway"
      need="inc"
      title="Incorporation runway"
      sub="Phases, the plan to the certificate, days left and what is stuck, per client"
      act={
        <div className="mx-chips">
          <span className="small">Nearest COI</span>
          {near.length ? (
            near.map((c) => (
              <span
                key={c.id}
                className={'pill ' + ((c.coiDays ?? 0) < 10 ? 'over' : 'mut')}
                title={`${c.name} · certificate expected by ${dShort(c.coi!, m.today)} (your incorporation window)`}
              >
                <CDot c={c} />
                {c.short} {(c.coiDays ?? 0) < 0 ? `${-(c.coiDays ?? 0)}d late` : `${c.coiDays}d`} · {dShort(c.coi!, m.today)}
              </span>
            ))
          ) : (
            <span className="small" title="Set an incorporation window on a client's page to see its target here">
              none set
            </span>
          )}
        </div>
      }
    >
      {loading ? (
        <SecLoading label="Loading the runway…" />
      ) : (
        <div className="tdy-scrollx">
          <div className="mx-rw tdy-rw">
            <div className="mx-rwh">
              <span>Client</span>
              <span className="mx-rwp">
                {m.all[0]?.model.phases.map((p, i) => (
                  <span key={p.id} title={p.title}>
                    {PHASE_KEY[i]}
                  </span>
                )) ?? null}
              </span>
              <div className="mx-gax" aria-hidden="true">
                {ticks.slice(0, -1).map((d, i) => (
                  <span key={d} className={d === nowWeek ? 'now' : ''} style={{ left: `${((i + 0.5) / weeks) * 100}%` }} title={`Week of ${dShort(d, m.today)}`}>
                    W{isoWeek(d)}
                  </span>
                ))}
              </div>
              <span>To COI</span>
              <span />
            </div>
            {rows.map(({ c, spans, stuckPhase }) => {
              const cur = c.current;
              return (
                <div key={c.id} className={'mx-rwr' + (c.late ? ' late' : '')}>
                  <button type="button" className="mx-tc3" title={`Open ${c.name}`} onClick={() => go(c.href)}>
                    <CAv c={c} />
                    <span>
                      <b className="tdy-ell">{c.short}</b>
                      <span className="small tdy-ell" title={cur ? cur.title : undefined}>
                        {cur ? `${stepCode(cur.id) ? stepCode(cur.id) + ' ' : ''}${cur.title}` : 'Every step done'}
                      </span>
                    </span>
                  </button>
                  <span className="mx-rwp">
                    {c.model.phases.map((p, i) => {
                      const s = p.state === 'done' ? 'd' : i === stuckPhase ? 's' : p.state === 'active' ? 'c' : 'n';
                      return (
                        <span key={p.id} className={'mx-phc ' + s} title={`${p.title} · ${p.done} of ${p.total}${s === 's' ? ' · stuck' : ''}`}>
                          {s === 'd' ? '✓' : s === 'n' ? '' : `${p.done}/${p.total}`}
                        </span>
                      );
                    })}
                  </span>
                  <div className="mx-gtrack">
                    {ticks.map((d) => (
                      <i key={d} className="gl" style={{ left: `${pct(d)}%` }} />
                    ))}
                    <i className="mx-gtoday" style={{ left: `${pct(m.today)}%` }} title={`Today · ${dShort(m.today, m.today)}`} />
                    {spans.map((s, i) => {
                      if (!s) return null;
                      const p = c.model.phases[i]!;
                      const left = pct(s.start);
                      const width = Math.max(pct(s.end) - left, 1.2);
                      const cls = i === 0 ? 'a' + (p.state === 'done' ? ' done' : '') : 'b' + (i === stuckPhase ? ' late' : p.state === 'done' ? ' done' : '');
                      return (
                        <span
                          key={p.id}
                          className={'mx-gb ' + cls}
                          style={{ left: `${left}%`, width: `calc(${width}% - 3px)`, minWidth: 6 } as CSSProperties}
                          title={`${p.title} · ${p.done} of ${p.total} · ${dShort(s.start, m.today)} to ${s.open ? 'today' : dShort(s.end, m.today)} · ${s.kind === 'planned' ? 'your plan' : 'as done'}`}
                        >
                          {PHASE_KEY[i]} {p.done}/{p.total}
                        </span>
                      );
                    })}
                    {c.coi ? <span className="mx-coid" style={{ left: `${pct(c.coi)}%` }} title={`COI target · ${dShort(c.coi, m.today)}`} /> : null}
                  </div>
                  <span className={'mx-rwc' + (c.coi && (c.coiDays ?? 0) < 10 ? ' red' : '')}>
                    {c.coi ? (
                      <>
                        <b>{(c.coiDays ?? 0) < 0 ? `${-(c.coiDays ?? 0)}d` : `${c.coiDays}d`}</b>
                        <small>{(c.coiDays ?? 0) < 0 ? `late · ${dShort(c.coi, m.today)}` : dShort(c.coi, m.today)}</small>
                      </>
                    ) : (
                      <small title="No incorporation window set on this client">Not set</small>
                    )}
                  </span>
                  {c.late && cur ? (
                    <span className="mx-rws">
                      <span className="pill over" title={`${cur.title} is ${c.lateDays} days past its window`}>
                        Stuck {c.lateDays}d
                      </span>
                      <button type="button" className="btn sm" onClick={() => go(stepPath(base, c.e, cur.id))}>
                        Open step
                      </button>
                    </span>
                  ) : (
                    <span className="mx-rws">
                      <span className="small" title="No step is past its window">
                        Moving
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
            {rows.length === 0 ? <span className="small">No incorporating clients in this view.</span> : null}
          </div>
        </div>
      )}
      <div className="mx-phleg" aria-label="What the marks mean">
        <span>
          <i className="mx-phc d" />
          Done
        </span>
        <span>
          <i className="mx-phc c" />
          Current
        </span>
        <span>
          <i className="mx-phc s" />
          Stuck
        </span>
        <span>
          <i className="mx-phc n" />
          Not started
        </span>
        <span>
          <i className="mx-coid sw" />
          COI target
        </span>
        <span>
          <i className="mx-gtoday sw" />
          Today
        </span>
        {m.all[0]?.model.phases.map((p, i) => (
          <span key={p.id}>
            <b className="tdy-key">{PHASE_KEY[i]}</b>
            {p.name}
          </span>
        )) ?? null}
        <span>
          <Icon name="help" size={16} />
          Bars use your dates where set, else the days the steps were done ({plural(rows.length, 'client')})
        </span>
      </div>
    </Panel>
  );
}
