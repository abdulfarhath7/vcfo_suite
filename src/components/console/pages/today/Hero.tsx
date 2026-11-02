'use client';

/**
 * Mission control (prototype a59o hero `.mx-mc`): the date and time, the
 * greeting, a one-line digest, five tiles that each open their breakdown, the
 * Stage switch, the doors to Approvals and Date requests, New project (the old
 * dashboard's button, kept) and the portfolio orbit.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { fmtL } from '@/components/portal/dates';

import { Btn, Seg, Sym } from '../../ui';
import { Drill, type DrillTab } from '../../overlays';
import { useConsole, type StageScope } from '../../runtime';
import { Orbit } from './Orbit';
import { clockIst, greetingIst, jump, qRows, wRows } from './bits';
import { Q_COLOR, Q_LABEL, Q_ORDER, firstName, plural, stepPath, type TodayModel, type WItem } from './model';

export function Hero({
  m,
  loading,
  approvalsAll,
  dateRequests,
  openWeekItem,
  weekColor,
}: {
  m: TodayModel;
  loading: boolean;
  approvalsAll: number;
  dateRequests: number;
  openWeekItem: (w: WItem) => void;
  weekColor: (w: WItem) => string;
}) {
  const { me, go, base, openPop, scope, setScope } = useConsole();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const showCmp = m.counts.cmp > 0 && scope !== 'inc';
  const lateSteps = m.kpi.over.filter((q) => q.source !== 'filing').length;
  const filingsNeed = m.queue.filter((q) => q.source === 'filing' && (q.state === 'over' || q.state === 'due')).length;
  const top = m.queue[0];
  const digest = loading
    ? 'Counting your book…'
    : `${lateSteps ? `${plural(lateSteps, 'step')} ${lateSteps === 1 ? 'is' : 'are'} late` : 'No step is late'}${showCmp ? `, ${plural(filingsNeed, 'filing')} ${filingsNeed === 1 ? 'needs' : 'need'} you.` : '.'}`;
  const digest2 = loading
    ? ''
    : top
      ? `Start with ${top.title} for ${m.byId[top.clientId]?.short ?? 'a client'}${top.state === 'over' ? ', it is overdue' : ''}.`
      : m.clients.length
        ? 'Nothing needs you or your leads right now.'
        : 'No clients in this view.';

  const qDrill = (title: string, sub: string, items: typeof m.queue, link: { text: string; id: string }) => (el: Element) => {
    const states = Q_ORDER.filter((s) => items.some((q) => q.state === s));
    const tabs: DrillTab[] = [{ label: 'All', rows: qRows(items, m, go) }, ...states.map((s) => ({ label: Q_LABEL[s], color: Q_COLOR[s], rows: qRows(items.filter((q) => q.state === s), m, go) }))];
    openPop(el, <Drill title={title} sub={sub} tabs={tabs} link={{ text: link.text, onClick: () => jump(link.id) }} />, { cls: 'mx-wide' });
  };

  const tiles: Array<{ key: string; label: string; n: number; tip: string; tone: string; style?: CSSProperties; open: (el: Element) => void }> = [
    {
      key: 'act',
      label: 'Act now',
      n: m.kpi.act.length,
      tip: 'Items where you or your leads act next',
      tone: 'ice',
      open: qDrill('Act now', `${plural(m.kpi.act.length, 'item')} where you or your leads act next`, m.kpi.act, { text: 'Go to Focus', id: 'mx-focus' }),
    },
    {
      key: 'over',
      label: 'Overdue',
      n: m.kpi.over.length,
      tip: 'Late steps and overdue filings',
      tone: 'over',
      open: (el) => {
        const steps = m.kpi.over.filter((q) => q.source !== 'filing');
        const fil = m.kpi.over.filter((q) => q.source === 'filing');
        openPop(
          el,
          <Drill
            title="Overdue"
            sub={`${plural(steps.length, 'late step')} · ${plural(fil.length, 'overdue filing')}`}
            tabs={[
              { label: 'All', rows: qRows(m.kpi.over, m, go) },
              { label: 'Steps', color: 'var(--over)', rows: qRows(steps, m, go) },
              { label: 'Filings', color: 'var(--over)', rows: qRows(fil, m, go) },
            ]}
            link={{ text: 'Go to Focus', onClick: () => jump('mx-focus') }}
          />,
          { cls: 'mx-wide' },
        );
      },
    },
    {
      key: 'wait',
      label: 'Waiting',
      n: m.kpi.wait.length,
      tip: 'On the client or MCA',
      tone: 'wait',
      style: { ['--k' as string]: 'var(--mx-wait)' } as CSSProperties,
      open: (el) => {
        const client = m.kpi.wait.filter((q) => q.holder === 'client');
        const mca = m.kpi.wait.filter((q) => q.holder === 'mca');
        openPop(
          el,
          <Drill
            title="Waiting"
            sub={`${plural(client.length, 'item')} on clients · ${mca.length} on MCA`}
            tabs={[
              { label: 'All', rows: qRows(m.kpi.wait, m, go) },
              { label: 'Client', color: 'var(--mx-wait)', rows: qRows(client, m, go) },
              { label: 'MCA', color: 'var(--law-MCA)', rows: qRows(mca, m, go) },
            ]}
            link={{ text: 'Go to Who holds the ball', onClick: () => jump('mx-ball') }}
          />,
          { cls: 'mx-wide' },
        );
      },
    },
    {
      key: 'week',
      label: 'This week',
      n: m.kpi.weekOpen.length,
      tip: 'Open items Monday to Sunday',
      tone: 'ink',
      open: (el) => {
        const lanes: Array<[WItem['lane'], string]> = [
          ['filing', 'Filings'],
          ['step', 'Step deadlines'],
          ['task', 'Team tasks'],
        ];
        openPop(
          el,
          <Drill
            title="This week"
            sub={`${plural(m.kpi.weekOpen.length, 'open item')} Monday to Sunday`}
            tabs={[
              { label: 'All', rows: wRows(m.kpi.weekOpen, m, openWeekItem, weekColor) },
              ...lanes.map(([lane, label]) => ({ label, rows: wRows(m.kpi.weekOpen.filter((w) => w.lane === lane), m, openWeekItem, weekColor) })),
            ]}
            link={{ text: 'Go to This week', onClick: () => jump('mx-week') }}
          />,
          { cls: 'mx-wide' },
        );
      },
    },
    {
      key: 'done',
      label: 'Done today',
      n: m.kpi.doneToday.length,
      tip: 'Steps and filings closed today',
      tone: 'ok',
      open: (el) => {
        const rows = (kind: 'step' | 'filing') =>
          m.kpi.doneToday
            .filter((d) => d.kind === kind)
            .map((d) => ({
              id: d.id,
              title: `${d.title} · ${m.byId[d.clientId]?.short ?? ''}`,
              meta: kind === 'step' ? 'Step done' : 'Filing filed',
              state: 'Done',
              color: 'var(--mx-ok)',
              onOpen: () => go(kind === 'step' && d.stepId ? stepPath(base, m.byId[d.clientId]!.e, d.stepId) : `${base}/compliances/filings`),
            }));
        openPop(
          el,
          <Drill
            title="Done today"
            sub="Steps and filings closed today"
            tabs={[
              { label: 'Steps', color: 'var(--mx-ok)', rows: rows('step') },
              { label: 'Filings', color: 'var(--mx-ok)', rows: rows('filing') },
            ]}
            link={{ text: 'Go to This week', onClick: () => jump('mx-week') }}
          />,
          { cls: 'mx-wide' },
        );
      },
    },
  ];

  const scopes: Array<{ value: StageScope; label: string; n: number }> = [
    { value: 'all', label: 'All clients', n: m.counts.all },
    { value: 'inc', label: 'Incorporating', n: m.counts.inc },
    { value: 'cmp', label: 'Compliance', n: m.counts.cmp },
  ];

  return (
    <section className="glass mx-mc" id="mx-hero">
      <div className="mx-mc-l">
        <div className="mx-mc-top">
          <span className="mx-live" title="Counted from your book now; the numbers refresh as the data changes">
            <i />
            Live
          </span>
          <span className="eyebrow">
            {fmtL(m.today)} · {clockIst(now)}
          </span>
        </div>
        <h1 className="mx-h1">
          {greetingIst(now)}, {firstName(me?.name ?? '')}
        </h1>
        <div className="mx-digest">
          <Sym id="m-robot" width={40} height={40} className="bot" />
          <div>
            <b>{digest}</b>
            {digest2 ? <span>{' ' + digest2}</span> : null}
          </div>
        </div>
        <div className="mx-ribbon" role="group" aria-label="Your day in numbers">
          {tiles.map((t) => (
            <button
              key={t.key}
              type="button"
              className={'mx-rb ' + t.tone}
              style={t.style}
              title={`${t.tip} · open the breakdown`}
              disabled={loading}
              onClick={(e) => t.open(e.currentTarget)}
            >
              <b>{loading ? '…' : t.n}</b>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="mx-mc-foot">
          <Seg
            ariaLabel="Show clients by stage"
            value={scope}
            onChange={setScope}
            options={scopes.map((s) => ({ value: s.value, label: s.label, n: s.n }))}
          />
          <span className="sp" />
          {approvalsAll || dateRequests ? (
            <div className="mx-gates">
              {approvalsAll ? (
                <button type="button" className="mx-gate" title="Steps waiting on your decision · open Approvals" onClick={() => go(`${base}/approvals`)}>
                  <b>{approvalsAll}</b>
                  <span>{approvalsAll === 1 ? 'approval' : 'approvals'}</span>
                </button>
              ) : null}
              {dateRequests ? (
                <button type="button" className="mx-gate" title="Timeline changes your clients asked for · open Date requests" onClick={() => go(`${base}/date-requests`)}>
                  <b>{dateRequests}</b>
                  <span>{dateRequests === 1 ? 'date request' : 'date requests'}</span>
                </button>
              ) : null}
            </div>
          ) : null}
          <Btn cls="sm" ico="build" onClick={() => go(`${base}/projects/new`)}>
            New project
          </Btn>
        </div>
      </div>
      <div className="mx-mc-r">
        <Orbit m={m} meInitials={me?.initials ?? ''} />
      </div>
    </section>
  );
}
