'use client';

/**
 * TODAY — the manager's first page (prototype a59o "mission control" + bento,
 * the later layout of the 17 Today panels):
 *
 *   hero          greeting, digest, five tiles, Stage switch, gates, orbit
 *   Focus         action queue + heat map            (c8)
 *   Who holds the ball                                 (c4)
 *   This week     lanes Mon–Sun                      (c12)
 *   Team tasks    table + status ring + lead bars    (c12)
 *   Incorporation runway   phase progress, phase bars, days to COI, stuck steps (c12, incorporating)
 *   Filing matrix          clients × filings + compliance health               (c12, compliance)
 *   Inbox         unread · my to-dos · team to-dos · waiting on (c6)
 *   Client health tiles                              (c6)
 *   Practice areas                                   (c12)
 *
 * Every count comes from the lists in `model.ts`. The old dashboard's real
 * functions are kept: New project, approvals, filings → calendar, projects,
 * the manager's own to-dos and the team's open to-dos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { hueOf } from '../../ui';
import { useConsole, useConsoleBadge, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Hero } from './Hero';
import { Focus } from './Focus';
import { Ball } from './Ball';
import { Week } from './Week';
import { TeamTasks } from './TeamTasks';
import { TeamItemDrawer } from './TeamDrawer';
import { Runway } from './Runway';
import { Matrix } from './Matrix';
import { Inbox } from './Inbox';
import { Health } from './Health';
import { Practice } from './Practice';
import { Notices } from './Notices';
import { usePendingDateRequests, useToday } from './useToday';
import { stepPath, type TItem, type WItem } from './model';
import '../../css/96-today.css';

const DAY_KEY = 'vcfo-today-day';

export function TodayPage() {
  useCrumbs(['Today']);
  const { model: m, loading, filings, approvalsAll } = useToday();
  const { scope, go, base, openDrawer } = useConsole();
  useConsoleBadge('approvals', approvalsAll, 'hot');

  const incIds = useMemo(() => m.clients.filter((c) => c.stage === 'inc').map((c) => c.id), [m.clients]);
  const dateRequests = usePendingDateRequests(incIds);

  /* the day picked in This week (remembered for the session, prototype MS.day) */
  const [day, setDayState] = useState('');
  useEffect(() => {
    try {
      const d = sessionStorage.getItem(DAY_KEY);
      if (d && m.week.includes(d)) setDayState(d);
    } catch {
      /* storage unavailable */
    }
    // read once per week shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.week[0]]);
  const setDay = useCallback((d: string) => {
    setDayState(d);
    try {
      if (d) sessionStorage.setItem(DAY_KEY, d);
      else sessionStorage.removeItem(DAY_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const openTeam = useCallback((t: TItem) => openDrawer(<TeamItemDrawer itemId={t.id} />), [openDrawer]);
  const openWeek = useCallback(
    (w: WItem) => {
      const c = m.byId[w.clientId];
      if (w.ref.kind === 'task' && w.ref.taskId) return openDrawer(<TeamItemDrawer itemId={`t:${w.ref.taskId}`} />);
      if (w.ref.kind === 'step' && w.ref.stepId && c) return go(stepPath(base, c.e, w.ref.stepId));
      go(`${base}/compliances/filings`);
    },
    [m.byId, go, base, openDrawer],
  );
  const weekColor = useCallback((w: WItem) => (w.lane === 'done' ? 'var(--mx-ok)' : w.day < m.today ? 'var(--over)' : 'var(--due)'), [m.today]);

  /* search: the book's leads (Ctrl K) */
  const palette = useMemo<PaletteItem[]>(
    () =>
      m.leads.map((l) => ({
        id: `lead:${l.key}`,
        label: l.name,
        kind: `Project lead · ${l.open.length} open`,
        sw: hueOf(l.key),
        go: () => go(`${base}/leads?lead=${encodeURIComponent(l.key)}`),
      })),
    [m.leads, go, base],
  );
  useConsolePalette('mgr-today-leads', palette);

  const showInc = scope !== 'cmp' && (loading || m.counts.inc > 0);
  const showCmp = scope !== 'inc' && (loading || m.counts.cmp > 0);

  return (
    <>
      <Hero m={m} loading={loading} approvalsAll={approvalsAll} dateRequests={dateRequests} openWeekItem={openWeek} weekColor={weekColor} />
      <div className="mx-bento">
        <div className="c8">
          <Focus m={m} loading={loading} />
        </div>
        <div className="c4">
          <Ball m={m} loading={loading} />
        </div>
        <div className="c12">
          <Week m={m} loading={loading} showCmp={showCmp} day={day} setDay={setDay} openItem={openWeek} color={weekColor} />
        </div>
        <div className="c12">
          <TeamTasks m={m} loading={loading} day={day} setDay={setDay} openItem={openTeam} />
        </div>
        {showInc ? (
          <div className="c12">
            <Runway m={m} loading={loading} />
          </div>
        ) : null}
        {showCmp ? (
          <div className="c12">
            <Matrix m={m} filings={loading ? { ...filings, loading: true } : filings} />
          </div>
        ) : null}
        <div className="c6">
          <Inbox m={m} />
        </div>
        <div className="c6">
          <Health m={m} loading={loading} />
        </div>
        <div className="c12">
          <Practice m={m} loading={loading} filings={filings} />
        </div>
      </div>
      <Notices m={m} loading={loading} />
    </>
  );
}
