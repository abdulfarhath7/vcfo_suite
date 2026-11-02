'use client';

/**
 * Sidebar · this month (prototype mxMini + mxDayPop): the month's days with an
 * underline in the colour of the worst filing status due that day (register
 * rows, in the Stage filter), today ringed. A day opens what falls on it —
 * filings, step deadlines (your schedule windows) and team tasks — each row
 * opening its page. The header links to the compliance calendar.
 */
import { useMemo } from 'react';
import { fmtL } from '@/components/portal/dates';

import { Empty } from '../../ui';
import { PopHead } from '../../overlays';
import { useConsole } from '../../runtime';
import { useToday } from '../../pages/today/useToday';
import { TeamItemDrawer } from '../../pages/today/TeamDrawer';
import { stepPath, F_COLOR, F_LABEL, T_COLOR, datedItems, monthLabel, plural, type FSt, type TodayModel, type WItem } from '../../pages/today/model';
import '../../css/96-today.css';

const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WORST: FSt[] = ['o', 'd', 'u', 'l', 'f'];
const UNDER: Record<FSt, string> = { o: 'o', d: 'd', u: 'u', l: 'f', f: 'f' };

function monthRange(today: string): { first: string; last: string; days: number; lead: number } {
  const y = Number(today.slice(0, 4));
  const mo = Number(today.slice(5, 7));
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const first = `${today.slice(0, 7)}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  return { first, last: `${today.slice(0, 7)}-${String(days).padStart(2, '0')}`, days, lead };
}

function DayPop({ day }: { day: string }) {
  const { model: m } = useToday();
  const { go, base, closePop, openDrawer } = useConsole();
  const items = datedItems(m, day, day);
  const fil = items.filter((w) => w.lane === 'filing');
  const steps = items.filter((w) => w.lane === 'step');
  const tasks = items.filter((w) => w.lane === 'task');
  const open = (w: WItem) => {
    closePop();
    const c = m.byId[w.clientId];
    if (w.ref.kind === 'task' && w.ref.taskId) openDrawer(<TeamItemDrawer itemId={`t:${w.ref.taskId}`} />);
    else if (w.ref.kind === 'step' && w.ref.stepId && c) go(stepPath(base, c.e, w.ref.stepId));
    else go(`${base}/compliances/filings`);
  };
  const row = (w: WItem, color: string, state: string, sub: string) => (
    <button key={w.id} type="button" className="mx-drow" onClick={() => open(w)}>
      <i style={{ background: color }} />
      <span className="mx-dt">
        <b>{w.title.split(' · ')[0]}</b>
        <span>{sub}</span>
      </span>
      <span className="mx-ds">{state}</span>
    </button>
  );
  return (
    <div>
      <PopHead title={fmtL(day)} sub={`${plural(fil.length, 'filing')} · ${plural(steps.length, 'step deadline')} · ${plural(tasks.length, 'team task')}`} />
      <div className="mx-drows">
        {fil.map((w) => {
          const f = m.byId[w.clientId]?.filings.find((x) => x.id === w.ref.filingId);
          return f ? row(w, F_COLOR[f.st], F_LABEL[f.st], `${m.byId[w.clientId]?.name ?? ''} · ${f.areaLabel}`) : null;
        })}
        {steps.map((w) => row(w, w.day < m.today ? T_COLOR.over : T_COLOR.due, w.day < m.today ? 'Overdue' : 'Step deadline', m.byId[w.clientId]?.name ?? ''))}
        {tasks.map((w) => {
          const t = m.team.find((x) => x.taskId === w.ref.taskId);
          return row(w, t ? T_COLOR[t.st] : T_COLOR.none, t ? `${t.leadName}` : 'Team task', m.byId[w.clientId]?.name ?? '');
        })}
        {!items.length ? <Empty title="A clear day" sub="No filings, step deadlines or team tasks fall on it." /> : null}
      </div>
    </div>
  );
}

function worstOn(m: TodayModel, items: WItem[], day: string): FSt | null {
  const sts = items
    .filter((w) => w.lane === 'filing' && w.day === day)
    .map((w) => m.byId[w.clientId]?.filings.find((f) => f.id === w.ref.filingId)?.st)
    .filter((s): s is FSt => !!s);
  return WORST.find((s) => sts.includes(s)) ?? null;
}

export function MiniCal() {
  const { model: m } = useToday();
  const { go, base, openPop } = useConsole();
  const r = monthRange(m.today);
  const items = useMemo(() => datedItems(m, r.first, r.last), [m, r.first, r.last]);

  return (
    <>
      <div className="mx-mh">
        <b>
          {monthLabel(m.today)} {m.today.slice(0, 4)}
        </b>
        <button type="button" className="link" onClick={() => go(`${base}/compliances/calendar`)}>
          Calendar
        </button>
      </div>
      <div className="mx-mg">
        {HEAD.map((d, i) => (
          <span key={`h${i}`} className="mx-mw" aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: r.lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: r.days }, (_, i) => {
          const day = `${m.today.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`;
          const w = worstOn(m, items, day);
          const on = items.filter((x) => x.day === day);
          const nf = on.filter((x) => x.lane === 'filing').length;
          return (
            <button
              key={day}
              type="button"
              className={'mx-md' + (day === m.today ? ' now' : '') + (w ? ' w-' + UNDER[w] : '')}
              title={`${fmtL(day)}${day === m.today ? ' · today' : ''}${nf ? ` · ${plural(nf, 'filing')}${w ? `, the worst ${F_LABEL[w].toLowerCase()}` : ''}` : ''}${on.length - nf ? ` · ${on.length - nf} more due` : ''}`}
              onClick={(e) => openPop(e.currentTarget, <DayPop day={day} />)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mx-mleg" aria-label="Underline colours">
        <span>
          <i style={{ background: '#ff6b6b' }} />
          Overdue
        </span>
        <span>
          <i style={{ background: '#fbbf24' }} />
          Due
        </span>
        <span>
          <i style={{ background: 'var(--mx-none2)' }} />
          Upcoming
        </span>
        <span>
          <i style={{ background: 'var(--mx-ok)' }} />
          Filed
        </span>
      </div>
    </>
  );
}
