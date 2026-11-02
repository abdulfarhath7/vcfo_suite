'use client';

/**
 * Obligations (COMPLIANCE-MODEL.md K-1, K-2; docs/ui-port/fixes/compliance-client.md),
 * in the Northwind portal's design: one section with a Statutory · Non-statutory ·
 * All switch and counts.
 *
 *  - Statutory = the register rows the Filings section already has (useFilings, the
 *    whole register), grouped by obligation (Farhath's `groupObligations`) under the
 *    frequency groups. A row opens the obligation's card: its periods, each opening
 *    the shared filing card (filings/actions.tsx), the walkthrough, and the D-4
 *    extras (filings/StatExtras.tsx).
 *  - Non-statutory = GET /api/compliances/tasks (his `useClientTasks`: the client's
 *    own engagement, visibility client or both), grouped This week / Next week /
 *    Later / Done with Task, Start, End, Urgency, With, Status (the six words). A
 *    row opens the full-screen task view (TaskView.tsx). No "New task" for clients.
 *
 * Also owns: the Obligations nav badge (overdue filings + overdue tasks), the
 * search items for tasks, and the `task` route intent
 * (/app/client/compliances/obligations/tasks/<id>).
 */
import { Fragment, useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { statusOf, type CompStatus, type PortalFiling } from '@/lib/client-portal/compliances';
import { FREQ_ORDER, freqKey, groupObligations, type Obligation } from '@/components/client-portal/pages/compliances/obligations';
import { showStat, showTasks, taskWord, weekGroups, type Category, type ClientTask } from '@/components/client-portal/pages/compliances/tasks';
import { useClientTasks } from '@/components/client-portal/pages/compliances/task-api';
import { useIntent, useNavBadge, usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { useFilings } from '../../data';
import { fmt, fmtY, fyOf, todayIso } from '../../dates';
import { PopHead } from '../../overlays';
import { Btn, DateTile, Icon, LawChip, Pill, SecError, SecHead, SecLoading, Seg, StatusPill } from '../../ui';
import { useFilingActions } from '../filings/actions';
import { StatExtrasCard } from '../filings/StatExtras';
import { cardPeriods, dueWords, firstName, FREQ_LABEL, OBLIGATION_WORD, overdueCount, statSummary, taskSummary } from './model';
import { Av, UrgencyMark, WordPill } from './bits';
import { TaskView } from './TaskView';
import '../../css/95-obligations.css';

function useOpenTask() {
  const { openWizard } = usePortal();
  return useCallback((id: string) => openWizard(<TaskView id={id} />), [openWizard]);
}

export function ObligationsSection() {
  const { shell, go, openPop, active } = usePortal();
  const today = todayIso();
  const q = useFilings();
  const tq = useClientTasks(true);
  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const tasks = useMemo(() => tq.data ?? [], [tq.data]);
  const obligations = useMemo(() => groupObligations(rows, today), [rows, today]);
  const [cat, setCat] = useState<Category>('statutory');
  const openTask = useOpenTask();
  const co = shell?.companyShort || 'your company';

  useNavBadge('obligations', overdueCount(rows, tasks, today) || undefined);
  const palette = useMemo<PaletteItem[]>(
    () =>
      tasks.map((t) => ({
        id: `task:${t.id}`,
        label: t.name,
        kind: `Task · ${fmt(t.endDate)} · ${taskWord(t, today)}`,
        sw: 'var(--ink-3)',
        go: () => {
          go('obligations');
          window.setTimeout(() => openTask(t.id), 60);
        },
      })),
    [tasks, today, go, openTask],
  );
  usePaletteItems('tasks', palette);
  // a task link (/app/client/compliances/obligations/tasks/<id>, a bell, or a click on the Calendar / Filings):
  // land on Obligations unless the client is already in a compliance section, then open the task view
  useIntent(['task'], Boolean(shell), (i) => {
    if (active !== 'obligations' && active !== 'calendar' && active !== 'filings') go('obligations');
    window.setTimeout(() => openTask(i.id), 60);
  });

  const stat = showStat(cat);
  const ns = showTasks(cat);
  const summary = [stat ? statSummary(obligations) : '', ns ? taskSummary(tasks, today) : ''].filter(Boolean).join(' · ');

  return (
    <>
      <SecHead title="Obligations" count={summary || undefined}>
        <Seg<Category>
          ariaLabel="Category"
          value={cat}
          onChange={setCat}
          options={[
            { value: 'statutory', label: 'Statutory', n: obligations.length },
            { value: 'non-statutory', label: 'Non-statutory', n: tasks.length },
            { value: 'all', label: 'All', n: obligations.length + tasks.length },
          ]}
        />
      </SecHead>
      {stat ? (
        <StatutoryList
          q={q}
          obligations={obligations}
          today={today}
          co={co}
          incorporated={shell ? shell.incorporated : true}
          onOpen={(o, el) => openPop(el, <ObligationCard o={o} />, { kind: 'obligation' })}
        />
      ) : null}
      {ns ? <TaskTable q={tq} tasks={tasks} today={today} co={co} onOpen={openTask} /> : null}
    </>
  );
}

/* ---------------------------------------------------------------- statutory */

function StatutoryList({
  q,
  obligations,
  today,
  co,
  incorporated,
  onOpen,
}: {
  q: ReturnType<typeof useFilings>;
  obligations: Obligation[];
  today: string;
  co: string;
  incorporated: boolean;
  onOpen: (o: Obligation, el: Element) => void;
}) {
  if (q.isError) return <SecError message="Your obligations could not load." onRetry={() => void q.refetch()} />;
  if (q.isPending) return <SecLoading label="Loading your obligations…" />;
  if (!obligations.length)
    return (
      <section className="glass panel">
        <p className="sec-empty">{incorporated ? `No obligations are on ${co}’s register yet. SBC adds them as your registrations come through.` : 'Your obligations start after incorporation. Nothing is due yet.'}</p>
      </section>
    );
  const groups = [...FREQ_ORDER, 'other'].map((k) => ({ id: k, label: FREQ_LABEL[k]!, rows: obligations.filter((o) => freqKey(o) === k) })).filter((g) => g.rows.length);
  return (
    <>
      {q.data?.fromCalendar ? (
        <div className="banner info" style={{ margin: '0 0 14px' }}>
          <Icon name="cal" />
          <div>
            <b>SBC’s compliance calendar, until your register starts</b>
            <span>{co} has no filings on its register yet. These are the obligations that will apply once it is incorporated and registered.</span>
          </div>
        </div>
      ) : null}
      <section className="glass ob-list" aria-label="Statutory obligations" style={{ marginBottom: 14 }}>
        {groups.map((g) => (
          <div key={g.id}>
            <div className="eyebrow">
              {g.label} · {g.rows.length}
            </div>
            {g.rows.map((o) => (
              <ObligationRow key={o.id} o={o} today={today} onClick={(e) => onOpen(o, e.currentTarget)} />
            ))}
          </div>
        ))}
      </section>
    </>
  );
}

const TILE: Record<CompStatus, 'over' | 'due' | 'ok' | null> = { over: 'over', due: 'due', ok: 'ok', up: null };

function ObligationRow({ o, today, onClick }: { o: Obligation; today: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const calendar = Boolean(o.instances[0]?.fromCalendar);
  const fy = fyOf(today).label;
  const line = o.next ? `${o.next.period} · due ${fmt(o.next.dueDate)}` : o.last?.filedOn ? `Last filed ${fmt(o.last.filedOn)}` : o.freqLabel;
  return (
    <button type="button" className="obrow" onClick={onClick}>
      <DateTile iso={o.tileDate} st={calendar ? null : TILE[o.status]} />
      <div style={{ minWidth: 0 }}>
        <b>{o.name}</b>
        <span className="s">
          <LawChip law={o.area} />
          {o.freqLabel} · {o.authorityName} · {line}
        </span>
      </div>
      <span className="rt">
        {!calendar ? (
          <span className="num small" title={fy}>
            {o.filed} of {o.total} filed
          </span>
        ) : null}
        {calendar ? <Pill kind="mut">SBC calendar</Pill> : <StatusPill st={o.status} label={OBLIGATION_WORD[o.status]} />}
      </span>
    </button>
  );
}

/** The live obligation (re-grouped from the register) behind an open card, else the one it opened with. */
function useLiveObligation(o0: Obligation): Obligation {
  const q = useFilings();
  const today = todayIso();
  return useMemo(() => groupObligations(q.data?.rows ?? [], today).find((o) => o.id === o0.id) ?? o0, [q.data, today, o0]);
}

const SHOW = 8;

/** One statutory obligation opened from the section: its facts, its periods and the ways in. */
function ObligationCard({ o: o0 }: { o: Obligation }) {
  const o = useLiveObligation(o0);
  const { openPop, openChat } = usePortal();
  const { openFiling, openFilingWizard } = useFilingActions();
  const today = todayIso();
  const [all, setAll] = useState(false);
  const periods = cardPeriods(o);
  const shown = all ? periods : periods.slice(0, SHOW);
  const focus = o.next ?? o.last;
  const calendar = Boolean(focus?.fromCalendar);
  const fy = fyOf(today).label;
  return (
    <div>
      <PopHead title={o.name} sub={`${o.authorityName} · ${o.freqLabel}`} lead={<LawChip law={o.area} />} />
      <div className="fc-grid">
        <div>
          <span>NEXT DUE</span>
          <b>{o.next ? fmtY(o.next.dueDate) : 'Nothing open'}</b>
        </div>
        <div>
          <span>STATUS</span>
          <b>{calendar ? 'Applies once incorporated' : OBLIGATION_WORD[o.status]}</b>
        </div>
        <div>
          <span>{fy}</span>
          <b>{calendar ? `${o.total} deadline${o.total === 1 ? '' : 's'}` : `${o.filed} of ${o.total} filed`}</b>
        </div>
        <div>
          <span>WITH</span>
          <b>{o.ownerName ? `${o.ownerName} · SBC` : 'SBC'}</b>
        </div>
      </div>
      <div className="eyebrow" style={{ margin: '14px 0 2px' }}>
        Periods · {periods.length}
      </div>
      {shown.map((f) => (
        <PeriodRow key={f.id} f={f} today={today} onClick={() => openFiling(f, null, { push: true })} />
      ))}
      {periods.length > SHOW && !all ? (
        <button type="button" className="small" style={{ marginTop: 8, textDecoration: 'underline' }} onClick={() => setAll(true)}>
          Show all {periods.length} periods
        </button>
      ) : null}
      <div className="fc-acts">
        {focus && !calendar ? (
          <Btn cls="pri" ico="step" onClick={() => openFilingWizard(focus)}>
            Step by step
          </Btn>
        ) : null}
        {focus && !calendar ? (
          <Btn ico="hist" onClick={() => openPop(null, <StatExtrasCard f={focus} />, { push: true, cls: 'wide' })}>
            Progress &amp; rule
          </Btn>
        ) : null}
        <Btn ico="chat" onClick={() => openChat(`What is ${o.name} and when is it due?`)}>
          Ask
        </Btn>
      </div>
    </div>
  );
}

function PeriodRow({ f, today, onClick }: { f: PortalFiling; today: string; onClick: () => void }) {
  const st = statusOf(f, today);
  const line = f.fromCalendar ? `SBC calendar · due ${fmt(f.dueDate)}` : f.filedOn ? `Filed ${fmt(f.filedOn)}${f.proofCount ? ` · ${f.proofCount} proof file${f.proofCount === 1 ? '' : 's'}` : ''}` : `${st === 'over' ? 'Overdue' : st === 'due' ? 'Due soon' : 'Upcoming'} · due ${fmt(f.dueDate)}`;
  return (
    <button type="button" className="pi" onClick={onClick}>
      <DateTile iso={f.dueDate} st={f.fromCalendar ? null : st === 'over' ? 'over' : st === 'due' ? 'due' : st === 'ok' ? 'ok' : null} />
      <div style={{ minWidth: 0 }}>
        <b>{f.period}</b>
        <div className="s">{line}</div>
      </div>
      <Icon name="chev" size={16} />
    </button>
  );
}

/* ---------------------------------------------------------------- non-statutory */

function TaskTable({
  q,
  tasks,
  today,
  co,
  onOpen,
}: {
  q: ReturnType<typeof useClientTasks>;
  tasks: ClientTask[];
  today: string;
  co: string;
  onOpen: (id: string) => void;
}) {
  if (q.isError) return <SecError message="Your tasks could not load." onRetry={() => void q.refetch()} />;
  if (q.isPending) return <SecLoading label="Loading your tasks…" />;
  if (!tasks.length)
    return (
      <section className="glass panel">
        <p className="sec-empty">No tasks are shared with you yet. The non-statutory work SBC does for {co} shows here once it is set up.</p>
      </section>
    );
  const groups = weekGroups(tasks, today);
  return (
    <section className="glass" style={{ overflow: 'hidden' }} aria-label="Non-statutory tasks">
      <div className="pnav">
        <h3>Non-statutory tasks</h3>
        <span className="small">
          {tasks.length} task{tasks.length === 1 ? '' : 's'} · grouped by end week
        </span>
      </div>
      <div className="ftb">
        <table className="ft ob-tasks">
          <thead>
            <tr>
              <th>Task</th>
              <th>Start</th>
              <th>End</th>
              <th>Urgency</th>
              <th>With</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.id}>
                <tr className="g">
                  <td colSpan={6}>
                    {g.id.toUpperCase()} · {g.rows.length}
                  </td>
                </tr>
                {g.rows.map((t) => (
                  <TaskRow key={t.id} t={t} today={today} onOpen={() => onOpen(t.id)} />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaskRow({ t, today, onOpen }: { t: ClientTask; today: string; onOpen: () => void }) {
  const word = taskWord(t, today);
  const late = word === 'Overdue';
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <tr className="r" tabIndex={0} onClick={onOpen} onKeyDown={onKey} aria-label={`${t.name} · ${word}`}>
      <td>
        <div className="fn">{t.name}</div>
        {t.activityName && t.activityName !== t.name ? <div className="fp">{t.activityName}</div> : null}
      </td>
      <td className="num" style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>
        {fmt(t.startDate)}
      </td>
      <td className={'num' + (late ? ' late' : '')} style={{ fontSize: 13.5, whiteSpace: 'nowrap' }} title={late ? dueWords(t.endDate, today, false) : undefined}>
        {fmt(t.endDate)}
      </td>
      <td>
        <UrgencyMark urgency={t.urgency} />
      </td>
      <td>
        {t.ownerName ? (
          <span className="ob-with" title={t.ownerName}>
            <Av name={t.ownerName} />
            {firstName(t.ownerName)}
          </span>
        ) : (
          <span className="small">SBC</span>
        )}
      </td>
      <td>
        <WordPill word={word} />
      </td>
    </tr>
  );
}
