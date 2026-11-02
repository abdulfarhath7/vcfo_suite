'use client';

/**
 * INCORPORATION — /app/manager/incorporation and /app/intern/incorporation (the old shell's
 * practice page "clients still incorporating", rule R-51, in the console's look). Four tiles
 * (clients incorporating, waiting on client, with you, stuck or overdue) that each filter the
 * table, a "With" switch, and one table: client, current step, progress, who holds it and for
 * how long, the next date, health. Every row opens the client. The numbers come from the same
 * Today model the rest of the console counts from (the caller's own book: a manager their
 * clients, a lead theirs), so they agree with Today and Clients. The page is one stage by
 * definition, so the top-bar Stage filter does not narrow it.
 */
import { useMemo, useState } from 'react';
import { SecLoading } from '@/components/portal/ui';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, ClientAv, Icon, Seg } from '../../ui';
import { useToday } from '../today/useToday';
import { HEALTH_COLOR, HEALTH_LABEL, HOLDER_LABEL, age, dShort, late as lateText, plural, stepCode, type Holder, type TClient } from '../today/model';
import { PHASE_SHORT } from './model';
import { HEALTH_LEGEND, useClientPaths } from './shared';
import '../../css/96-clients.css';
import '../../css/96-practice.css';

type Filter = 'all' | Holder | 'late';

/** A step past its window, an overdue next date, or a client the health rule calls Stuck. */
export function isLateClient(c: Pick<TClient, 'late' | 'health' | 'next'>): boolean {
  return c.late || c.health === 'stuck' || Boolean(c.next?.overdue);
}

const WITH: Array<{ value: Holder; label: string }> = [
  { value: 'client', label: 'Client' },
  { value: 'you', label: 'You' },
  { value: 'mgr', label: 'Manager' },
  { value: 'mca', label: 'MCA' },
];

export function IncorporationPage() {
  useCrumbs(['Incorporation']);
  const { go } = useConsole();
  const paths = useClientPaths();
  const { model: m, loading } = useToday();
  const [filter, setFilter] = useState<Filter>('all');

  const all = useMemo(() => m.all.filter((c) => c.stage === 'inc').sort((a, b) => a.done - b.done || a.name.localeCompare(b.name)), [m.all]);
  const count = (h: Holder) => all.filter((c) => c.holder === h).length;
  const lateN = all.filter(isLateClient).length;
  const rows = filter === 'all' ? all : filter === 'late' ? all.filter(isLateClient) : all.filter((c) => c.holder === filter);
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? 'all' : f));

  const tiles: Array<{ key: Filter; label: string; n: number; tone: string; tip: string }> = [
    { key: 'all', label: 'Clients incorporating', n: all.length, tone: 'ice', tip: 'Every client before its certificate of incorporation' },
    { key: 'client', label: 'Waiting on client', n: count('client'), tone: 'due', tip: 'The current step waits on the client' },
    { key: 'you', label: 'With you', n: count('you'), tone: 'ink', tip: 'The current step waits on you' },
    { key: 'late', label: 'Stuck or overdue', n: lateN, tone: 'over', tip: 'A step is past its window, the next date has passed, or the client is stuck' },
  ];
  const withOptions = [{ value: 'all' as Filter, label: 'All', n: all.length }, ...WITH.map((w) => ({ value: w.value as Filter, label: w.label, n: count(w.value) })), { value: 'late' as Filter, label: 'Late', n: lateN }];

  return (
    <>
      <div className="sec-h">
        <h2>Incorporation</h2>
        <span className="sec-count">{loading ? 'Loading…' : `${plural(all.length, 'client')} incorporating · ${count('client')} waiting on clients · ${lateN} stuck or overdue`}</span>
      </div>

      <div className="mx-kpis inc-kpis" role="group" aria-label="Incorporation in numbers">
        {tiles.map((t) => (
          <button key={t.key} type="button" className={'mx-kpi ' + t.tone} aria-pressed={filter === t.key} title={t.tip} disabled={loading} onClick={() => toggle(t.key)}>
            <span>{t.label}</span>
            <b>{loading ? '–' : t.n}</b>
            <small>{filter === t.key && t.key !== 'all' ? 'Showing these · click to show all' : 'Click to show these'}</small>
          </button>
        ))}
      </div>

      <section className="glass panel mx-p">
        <div className="ph">
          <div className="mx-pt">
            <h3>Clients in incorporation</h3>
            <span className="small">{loading ? 'Counting your book…' : `${plural(rows.length, 'client')} · fewest steps done first · a row opens the client`}</span>
          </div>
          <span className="sp" />
          <Seg<Filter> className="sm" ariaLabel="Who holds the current step" value={filter} onChange={setFilter} options={withOptions} />
        </div>
        {loading ? (
          <SecLoading label="Loading the clients…" />
        ) : all.length === 0 ? (
          <>
            <div className="mx-empty">
              <Icon name="check" />
              <b>No client is incorporating right now</b>
              <span>Clients appear here from their first step until the certificate of incorporation.</span>
            </div>
            <div className="cx-center">
              <Btn cls="sm" ico="grid" onClick={() => go(paths.list)}>
                View clients
              </Btn>
            </div>
          </>
        ) : rows.length === 0 ? (
          <div className="mx-empty">
            <Icon name="check" />
            <b>No client matches this filter</b>
            <span>Switch to All to see every incorporating client.</span>
          </div>
        ) : (
          <div className="inc-scroll">
            <div className="mx-table inc-tbl">
              <div className="mx-th">
                <span>Client</span>
                <span>Current step</span>
                <span>Progress</span>
                <span>With</span>
                <span>Next</span>
                <span>Status</span>
              </div>
              {rows.map((c) => (
                <Row key={c.id} c={c} today={m.today} />
              ))}
            </div>
          </div>
        )}
        {!loading && all.length ? (
          <div className="cx-foot">
            <div className="mx-leg cx-leg" aria-label="Health">
              {HEALTH_LEGEND.map((h) => (
                <span key={h.label} className="cx-lk" title={`${h.label}: ${h.why}`}>
                  <i className="cx-dot" style={{ background: h.color }} />
                  {h.label}
                </span>
              ))}
            </div>
            <span className="sp" />
            <span className="small" title="Who holds the current step, and for how many days it has been with them">
              With: who holds the current step · days it has been there
            </span>
          </div>
        ) : null}
      </section>
    </>
  );
}

function Row({ c, today }: { c: TClient; today: string }) {
  const { go } = useConsole();
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const stepLabel = c.current ? `${stepCode(c.current.id)} ${c.current.title}`.trim() : 'Every step is done';
  const holderKind = c.holder === 'client' || c.holder === 'you' ? 'due' : 'mut';
  const late = isLateClient(c);
  return (
    <button type="button" className={'mx-tr' + (late ? ' hot' : '')} aria-label={`Open ${c.name}`} onClick={() => go(c.href)}>
      <span className="inc-cl">
        <ClientAv id={c.id} label={c.initials} />
        <span className="mx-dt">
          <b className="inc-ell" title={c.name}>
            {c.name}
          </b>
          <span className="inc-ell" title={c.leadName ? `Project lead ${c.leadName}` : undefined}>
            {c.leadName ? `lead ${c.leadName}` : 'no lead yet'}
          </span>
        </span>
      </span>
      <span className="mx-dt">
        <b className="inc-ell" title={stepLabel}>
          {stepLabel}
        </b>
        <span className="inc-ell">{c.current ? (PHASE_SHORT[c.phaseIdx] ?? '') : 'Ready for the certificate'}</span>
      </span>
      <span className="inc-prog" title={`${c.done} of ${c.total} steps done`}>
        <span className="inc-bar" role="img" aria-label={`${c.done} of ${c.total} steps done`}>
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="small">
          {c.done} / {c.total}
        </span>
      </span>
      <span>
        {c.holder ? (
          <span className={`pill ${holderKind} sm`} title={`Who holds the current step: ${HOLDER_LABEL[c.holder]}${c.heldDays !== undefined ? `, for ${age(c.heldDays)}` : ''}`}>
            {HOLDER_LABEL[c.holder]}
            {c.heldDays !== undefined ? ` · ${age(c.heldDays)}` : ''}
          </span>
        ) : (
          <span className="small">–</span>
        )}
      </span>
      <span className="mx-dt">
        {c.next ? (
          <>
            <b className={c.next.overdue ? 'inc-over' : ''} title={c.next.overdue ? 'This date has passed' : undefined}>
              {dShort(c.next.iso, today)}
            </b>
            <span className="inc-ell" title={c.next.what}>
              {c.next.what}
            </span>
          </>
        ) : (
          <span className="small">–</span>
        )}
      </span>
      <span className="inc-st">
        <span className="mx-hh" title={`Health: ${HEALTH_LABEL[c.health]} · ${c.healthWhy}`}>
          <i style={{ background: HEALTH_COLOR[c.health] }} />
          {HEALTH_LABEL[c.health]}
        </span>
        {c.late ? <span className="pill over sm">{lateText(c.lateDays)}</span> : null}
      </span>
    </button>
  );
}
