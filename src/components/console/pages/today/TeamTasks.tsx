'use client';

/**
 * Team tasks and their status in one panel (prototype mxTeam, manager only):
 * the leads' work — team tasks, each client's current step, filings due or
 * overdue, and what closed this week — filterable by lead, company, status
 * (the ring and its legend) and the day picked in This week. The bars show
 * each lead's open items; the red part is overdue.
 */
import { useState } from 'react';
import { SecLoading } from '@/components/portal/ui';
import { fmtL } from '@/components/portal/dates';
import { Donut, Empty, Icon, LeadAv, Legend, Panel, Select, hueOf } from '../../ui';
import { Drill } from '../../overlays';
import { useConsole } from '../../runtime';
import { CDot, tRows } from './bits';
import { T_COLOR, T_LABEL, T_ORDER, T_PILL, firstName, personInitials, plural, type TItem, type TSt, type TodayModel } from './model';

const SHOW = 8;

export function TeamTasks({
  m,
  loading,
  day,
  setDay,
  openItem,
}: {
  m: TodayModel;
  loading: boolean;
  day: string;
  setDay: (d: string) => void;
  openItem: (t: TItem) => void;
}) {
  const { go, base: seatBase, openPop, me } = useConsole();
  const [lead, setLead] = useState('');
  const [co, setCo] = useState('');
  const [st, setSt] = useState<TSt | ''>('');
  const [all, setAll] = useState(false);

  const base = m.team.filter((t) => (!lead || t.leadKey === lead) && (!co || t.clientId === co) && (!day || t.due === day));
  const rows = base.filter((t) => !st || t.st === st);
  const shown = all ? rows : rows.slice(0, SHOW);
  const parts = T_ORDER.map((s) => ({ n: base.filter((t) => t.st === s).length, color: T_COLOR[s], label: T_LABEL[s] }));
  const openN = base.filter((t) => t.st !== 'done').length;
  const any = lead || co || st || day;
  const barMax = Math.max(1, ...m.leads.map((l) => l.open.length));
  const leadOpts: Array<[string, string]> = [['', 'All project leads'], ...m.leads.map((l) => [l.key, l.name] as [string, string])];
  if (m.team.some((t) => t.leadKey === '@me')) leadOpts.push(['@me', 'You']);
  const coOpts: Array<[string, string]> = [['', 'All companies'], ...m.clients.map((c) => [c.id, c.short] as [string, string])];

  const drill = (i: number, el: Element | null) =>
    openPop(
      el,
      <Drill
        title="Team tasks"
        sub={`${plural(base.length, 'item')}${lead ? ` · ${leadOpts.find((o) => o[0] === lead)?.[1]}` : ''}${co ? ` · ${m.byId[co]?.short}` : ''}`}
        active={i + 1}
        tabs={[{ label: 'All', rows: tRows(base, m, openItem) }, ...T_ORDER.map((s) => ({ label: T_LABEL[s], color: T_COLOR[s], rows: tRows(base.filter((t) => t.st === s), m, openItem) }))]}
        link={{ text: 'Open my work', onClick: () => go(`${seatBase}/work`) }}
      />,
      { cls: 'mx-wide' },
    );

  const av = (t: TItem) =>
    t.leadKey === '@me' ? (
      <LeadAv id={me?.id ?? 'me'} name={me?.name ?? 'You'} initials={me?.initials ?? 'Y'} sm />
    ) : (
      <LeadAv id={t.leadKey} name={t.leadName} initials={t.leadKey.startsWith('@') ? '–' : personInitials(t.leadName)} sm />
    );

  return (
    <Panel
      id="mx-team"
      title="Team tasks"
      sub={loading ? 'Loading…' : `${rows.length} of ${plural(m.team.length, 'item')} · overdue first · click the ring or a status to filter`}
    >
      {loading ? (
        <SecLoading label="Loading your team's work…" />
      ) : (
        <div className="mx-teamg">
          <div className="mx-teaml">
            <div className="mx-filters" style={{ marginBottom: 10 }}>
              <Select value={lead} options={leadOpts} onChange={setLead} label="Project lead" />
              <Select value={co} options={coOpts} onChange={setCo} label="Company" />
              {st ? (
                <span className="mx-fchip" style={{ margin: 0 }}>
                  Status <b>{T_LABEL[st]}</b>
                  <button type="button" className="ib x" aria-label="Clear the status" onClick={() => setSt('')}>
                    <Icon name="x" />
                  </button>
                </span>
              ) : null}
              {day ? (
                <span className="mx-fchip" style={{ margin: 0 }}>
                  Due <b>{fmtL(day)}</b>
                  <button type="button" className="ib x" aria-label="Clear the day" onClick={() => setDay('')}>
                    <Icon name="x" />
                  </button>
                </span>
              ) : null}
              {any ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setLead('');
                    setCo('');
                    setSt('');
                    setDay('');
                  }}
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="tdy-scrollx">
              <div className="mx-table mx-tt" aria-label="Team tasks">
                <div className="mx-th">
                  <span>Task</span>
                  <span>Lead · due</span>
                  <span>Company</span>
                  <span>Status</span>
                </div>
                {shown.length ? (
                  shown.map((t) => {
                    const c = m.byId[t.clientId];
                    return (
                      <button key={t.id} type="button" className={'mx-tr' + (t.st === 'over' ? ' st-bad' : '')} onClick={() => openItem(t)}>
                        <span className="mx-tc1">
                          <b className="tdy-ell" title={t.title}>
                            {t.title}
                          </b>
                          <span className="small tdy-ell">{t.sub}</span>
                        </span>
                        <span className="mx-tc2">
                          {av(t)}
                          <span>
                            <b className="tdy-ell" title={t.leadName}>
                              {t.leadKey === '@me' ? 'You' : firstName(t.leadName)}
                            </b>
                            <span className={'small' + (t.st === 'over' ? ' red' : '')}>{t.dueLabel}</span>
                          </span>
                        </span>
                        <span className="mx-tc3">
                          {c ? <CDot c={c} /> : null}
                          <span className="tdy-ell" title={c?.name}>
                            {c?.short}
                          </span>
                        </span>
                        <span>
                          <span className={'pill ' + T_PILL[t.st]}>{T_LABEL[t.st]}</span>
                        </span>
                      </button>
                    );
                  })
                ) : m.team.length ? (
                  <Empty title="No items match" sub="Clear the filters to see every item." />
                ) : (
                  <Empty title="Your leads have nothing open" sub="Team tasks, current steps and filings due soon show up here." />
                )}
              </div>
            </div>
            {rows.length > SHOW ? (
              <button type="button" className="mx-showall" onClick={() => setAll((v) => !v)}>
                {all ? 'Show fewer' : `Show all ${rows.length}`}
              </button>
            ) : null}
          </div>
          <div className="mx-teamr">
            <div className="mx-ts">
              <Donut parts={parts} size={132} onPick={(i, el) => drill(i, el)} center={[openN, 'open']} />
              <Legend
                parts={parts}
                active={st ? T_ORDER.indexOf(st) : undefined}
                onPick={(i) => setSt(st === T_ORDER[i] ? '' : T_ORDER[i]!)}
              />
            </div>
            <div className="mx-sub-h">
              <span className="eyebrow">Open by project lead</span>
              <span className="small">red = overdue</span>
            </div>
            <div className="mx-lbars">
              {m.leads.length === 0 ? <span className="small">No project leads on your clients yet.</span> : null}
              {m.leads.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className="mx-lb"
                  title={`${l.name}: ${l.open.length} open, ${l.overdue} overdue · open their workload`}
                  onClick={() => go(`${seatBase}/leads?lead=${encodeURIComponent(l.key)}`)}
                >
                  <LeadAv id={l.key} name={l.name} initials={l.initials} sm />
                  <span className="mx-lbn tdy-ell">{firstName(l.name)}</span>
                  <span className="mx-lbt">
                    <i className="r" style={{ width: `${(l.overdue / barMax) * 100}%` }} />
                    <i style={{ width: `${((l.open.length - l.overdue) / barMax) * 100}%`, background: hueOf(l.key) }} />
                  </span>
                  <b>{l.open.length}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
