'use client';

/**
 * OBLIGATIONS — /app/manager/compliances/obligations (and the lead seat's
 * /app/intern/compliances/obligations). The console's form of the live staff
 * ObligationsView (prototype C-0108 + the 30 Oct Compliances model):
 *
 *   Statutory · Non-statutory · All   the category switch with counts (S-1, `?cat=`)
 *   number strip                      Overdue · Due soon · Waiting on client · Done · Not started,
 *                                     counting the category in view, filtering on click (`?state=`)
 *   statutory                         the register of the current FY (the book Filings and the
 *                                     Calendar already load) grouped By filing (band = the period that
 *                                     needs attention, client rows under it), By frequency or By law
 *                                     (`?by=`); a row opens that client's period, a band the obligation
 *   non-statutory                     `GET /api/compliances/tasks` grouped This week · Next week · Later ·
 *                                     Done with Task, Start, End, Urgency, Visibility, Owner, Reviewer,
 *                                     Status (six words), plus the route's filters (`?status=`,
 *                                     `?urgency=`, `?vis=`, `?mine=1`)
 *   New task                          admin, super admin and manager (the route's role table; a lead
 *                                     gets 403, S-4)
 *   rail                              this month's flow, due soon, waiting on client, done recently
 */
import { Suspense, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AREA_LABEL, AREA_ORDER, fyStartOfMonth, type AreaCode } from '@/lib/client-portal/compliances';
import { isAdminOrManager } from '@/lib/auth';
import { SecError } from '@/components/portal/ui';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, ClientAv, Empty, Icon, Panel, Seg, Select } from '../../ui';
import { dDay, dShort, plural } from '../today/model';
import { useTodayIso } from '../today/useToday';
import { C_LABEL, C_TIP, type BookClient } from './model';
import { useBook, useComplianceBadges } from './data';
import { CompanySelect, ComplianceBanners, LawTag } from './shared';
import { useTaskList, type TaskRowDto } from './obligations-data';
import {
  CAT_LABEL,
  FREQ_BUCKETS,
  GROUP_LABEL,
  SOON_DAYS,
  STRIP_COLOR,
  STRIP_KEYS,
  STRIP_LABELS,
  URGENCIES,
  WEEK_COLOR,
  WORDS,
  dueWithinSoon,
  dueWords,
  flowCounts,
  freqBucket,
  groupObligations,
  groupTasksByWeek,
  hrefs,
  parseCat,
  parseGroupBy,
  parseStrip,
  parseTaskFilters,
  statMatches,
  taskFiltersOn,
  taskMatches,
  type Cat,
  type GroupBy,
  type ObGroup,
  type ObRow,
  type StatusWord,
  type StripKey,
  type Urgency,
  type Visibility,
} from './obligations-model';
import { DTile, PersonChip, UrgencyMark, VisMark, WordPill } from './obligations-shared';
import { NewTaskModal } from './task-modals';

export function ObligationsPage() {
  return (
    <Suspense
      fallback={
        <div className="glass panel mx-p">
          <div className="sec-load">Loading the obligations…</div>
        </div>
      }
    >
      <Obligations />
    </Suspense>
  );
}

interface FlatRow extends ObRow {
  g: ObGroup;
}

function Obligations() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { base, go, me, openModal } = useConsole();
  const today = useTodayIso();
  const H = hrefs(base);
  useComplianceBadges();

  const fy = fyStartOfMonth(today.slice(0, 7));
  const cat = parseCat(params.get('cat'));
  const hasStat = cat !== 'ns';
  const hasNs = cat !== 'stat';
  const groupBy = parseGroupBy(params.get('by'));
  const strip = parseStrip(params.get('state'));
  const canCreate = isAdminOrManager(me?.role);

  const data = useBook(fy);
  const { book } = data;
  const sole = book.clients.length === 1 ? book.clients[0] : undefined;
  const rawCompany = params.get('company');
  const company = sole ? sole.id : rawCompany && book.byId[rawCompany]?.inScope ? rawCompany : 'all';
  const picked = company !== 'all' ? book.byId[company] : undefined;
  useCrumbs(picked ? ['Obligations', picked.short] : ['Obligations']);

  useEffect(() => {
    if (data.leadHasNothing) router.replace(`${base}/today`);
  }, [data.leadHasNothing, router, base]);

  const setParams = (next: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) s.delete(k);
      else s.set(k, v);
    }
    const q = s.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  /* ---------- statutory: the register regrouped by obligation */
  const regRows = useMemo(() => book.rows.filter((r) => !r.cal && (company === 'all' || r.clientId === company)), [book.rows, company]);
  const groups = useMemo(() => groupObligations(regRows), [regRows]);
  const flat = useMemo<FlatRow[]>(() => groups.flatMap((g) => g.rows.map((x) => ({ ...x, g }))), [groups]);

  /* ---------- non-statutory: the route with its filters */
  const tf = parseTaskFilters((k) => params.get(k), company !== 'all' ? company : undefined);
  const tasksQ = useTaskList(tf);
  const tasks = useMemo(() => (tasksQ.data?.tasks ?? []).filter((t) => !t.hidden), [tasksQ.data]);

  /* ---------- the strip counts the category in view */
  const count = (f: StripKey) => (hasStat ? flat.filter((x) => statMatches(x, f)).length : 0) + (hasNs ? tasks.filter((t) => taskMatches(t, f)).length : 0);
  const shownFlat = flat.filter((x) => statMatches(x, strip));
  const shownTasks = tasks.filter((t) => taskMatches(t, strip));

  /* ---------- rail */
  const monthKey = today.slice(0, 7);
  const flow = flowCounts(regRows.filter((r) => r.due.slice(0, 7) === monthKey));
  const byDue = (a: TaskRowDto, b: TaskRowDto) => a.dueDate.localeCompare(b.dueDate);
  const soonItems: RailItem[] = [
    ...(hasStat
      ? flat
          .filter((x) => dueWithinSoon(x.r))
          .sort((a, b) => a.r.due.localeCompare(b.r.due))
          .map((x) => ({ key: x.key, title: x.g.name, sub: x.r.clientName, right: dShort(x.r.due, today), href: H.statutory(x.g.obligationId, x.key) }))
      : []),
    ...(hasNs
      ? tasks
          .filter((t) => t.word !== 'Done' && t.week === 'This week')
          .sort(byDue)
          .map((t) => taskRail(t, today, H.task(t.id)))
      : []),
  ].slice(0, 5);
  const waitingItems: RailItem[] = [
    ...(hasStat
      ? flat
          .filter((x) => x.waiting)
          .sort((a, b) => a.r.due.localeCompare(b.r.due))
          .map((x) => ({ key: x.key, title: x.g.name, sub: x.r.clientName, right: dueWords(x.r.days), red: x.r.days < 0, href: H.statutory(x.g.obligationId, x.key) }))
      : []),
    ...(hasNs ? tasks.filter((t) => t.word === 'Waiting').sort(byDue).map((t) => taskRail(t, today, H.task(t.id))) : []),
  ].slice(0, 5);
  const doneItems: RailItem[] = [
    ...(hasStat
      ? regRows
          .filter((r) => r.filedOn)
          .sort((a, b) => (b.filedOn ?? '').localeCompare(a.filedOn ?? ''))
          .slice(0, 4)
          .map((r) => ({ key: r.id, title: r.name, sub: r.clientName, right: `Filed ${dShort(r.filedOn!, today)}`, href: H.statutory(r.reg!.obligationId, r.id) }))
      : []),
    ...(hasNs
      ? tasks
          .filter((t) => t.word === 'Done')
          .sort((a, b) => (b.completedAt ?? b.dueDate).localeCompare(a.completedAt ?? a.dueDate))
          .map((t) => taskRail(t, today, H.task(t.id)))
      : []),
  ].slice(0, 4);
  const inStage = (...st: TaskRowDto['stage'][]) => tasks.filter((t) => st.includes(t.stage)).length;
  const flowSteps =
    cat === 'stat'
      ? [
          ['Data from client', flow.data],
          ['Prepared', flow.prepared],
          ['Filed', flow.filed],
          ['Acknowledged', flow.acknowledged],
        ]
      : [
          ['Not started', (hasStat ? count('none') : 0) + inStage('not-started', 'ready')],
          ['Waiting on client', (hasStat ? flat.filter((x) => x.waiting).length : 0) + inStage('waiting')],
          ['In progress', (hasStat ? flow.prepared : 0) + inStage('in-progress', 'review', 'rework')],
          ['Done', (hasStat ? flat.filter((x) => Boolean(x.r.filedOn)).length : 0) + inStage('completed')],
        ];

  const companyQ = company !== 'all' && !sole ? `company=${company}` : '';
  const L = STRIP_LABELS[cat];
  const filtersOn = strip !== '' || taskFiltersOn(tf);
  const newTask = () =>
    openModal(
      <NewTaskModal
        clients={book.clients.map((c) => ({ id: c.id, name: c.name }))}
        defaultClient={company !== 'all' ? company : undefined}
        today={today}
        onCreated={(t) => {
          const next: Record<string, string | null> = { cat: cat === 'stat' ? 'ns' : cat, state: null, status: null, urgency: null, vis: null };
          if (company !== 'all' && company !== t.engagementId) next.company = null;
          setParams(next);
        }}
      />,
      { label: 'New task' },
    );

  const listTitle = cat === 'stat' ? 'Statutory obligations' : cat === 'ns' ? 'Non-statutory tasks' : 'Every obligation';
  const listSub = data.loading
    ? 'Loading…'
    : [
        hasStat ? `${plural(shownFlat.length, 'filing')} across ${plural(groups.length, 'obligation')} · ${book.fyLabel}` : '',
        hasNs ? (tasksQ.isPending ? 'loading tasks' : `${plural(shownTasks.length, 'task')}`) : '',
        strip ? `${L[strip as Exclude<StripKey, ''>]} only` : '',
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <>
      <div className="sec-h">
        <h2>Obligations</h2>
        <span className="sec-count">{book.fyLabel}</span>
        <span className="sp" />
        {book.clients.length > 1 ? <CompanySelect clients={book.clients} value={company} onChange={(v) => setParams({ company: v === 'all' ? null : v })} /> : null}
        {canCreate ? (
          <Btn cls="sm pri" ico="step" title="Add a non-statutory task for a client" onClick={newTask}>
            New task
          </Btn>
        ) : null}
        <Btn cls="sm" ico="cal" onClick={() => go(`${base}/compliances/calendar${companyQ ? `?${companyQ}` : ''}`)}>
          Calendar
        </Btn>
        <Btn cls="sm" ico="calc" onClick={() => go(`${base}/compliances/filings${companyQ ? `?${companyQ}` : ''}`)}>
          Filings
        </Btn>
      </div>

      {!data.loading ? <ComplianceBanners book={book} company={company} /> : null}

      <section className="glass mx-fribbon" aria-label={`${CAT_LABEL[cat]} at a glance`}>
        <div className="mx-frbar">
          {STRIP_KEYS.map((k) => {
            const n = count(k);
            return (
              <button
                key={k}
                type="button"
                className={strip === k ? 'on' : ''}
                aria-pressed={strip === k}
                style={{ flex: n || 0.3, ['--bc' as string]: STRIP_COLOR[k] }}
                title={`${L[k]} · ${n} ${cat === 'stat' ? 'filings' : cat === 'ns' ? 'tasks' : 'items'} · ${strip === k ? 'click to show everything' : 'click to show only these'}`}
                onClick={() => setParams({ state: strip === k ? null : k })}
              >
                <b>{data.loading || (hasNs && tasksQ.isPending) ? '–' : n}</b>
                <span>{L[k]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mx-row21 cob-cols">
        <section className="glass panel mx-p cob-list">
          <div className="ph">
            <div className="mx-pt">
              <h3>{listTitle}</h3>
              <span className="small">{listSub}</span>
            </div>
            <span className="sp" />
            <Seg<Cat>
              className="sm"
              ariaLabel="Statutory, non-statutory or every obligation"
              value={cat}
              onChange={(v) => setParams({ cat: v === 'stat' ? null : v })}
              options={[
                { value: 'stat', label: 'Statutory', n: data.loading ? '–' : flat.length },
                { value: 'ns', label: 'Non-statutory', n: tasksQ.isPending ? '–' : tasks.length },
                { value: 'all', label: 'All', n: data.loading || tasksQ.isPending ? '–' : flat.length + tasks.length },
              ]}
            />
          </div>
          <div className="cob-bar">
            {hasStat ? (
              <Seg<GroupBy>
                className="sm"
                ariaLabel="Group the statutory rows"
                value={groupBy}
                onChange={(v) => setParams({ by: v === 'filing' ? null : v })}
                options={(['filing', 'frequency', 'law'] as GroupBy[]).map((g) => ({ value: g, label: GROUP_LABEL[g] }))}
              />
            ) : null}
            {hasNs ? (
              <>
                <Select<StatusWord | 'all'> label="Task status" value={tf.status || 'all'} onChange={(v) => setParams({ status: v === 'all' ? null : v })} options={[['all', 'Every status'], ...WORDS.map((w): [StatusWord, string] => [w, w])]} />
                <Select<Urgency | 'all'> label="Urgency" value={tf.urgency || 'all'} onChange={(v) => setParams({ urgency: v === 'all' ? null : v })} options={[['all', 'Every urgency'], ...URGENCIES.map((u): [Urgency, string] => [u, u])]} />
                <Select<Visibility | 'all'>
                  label="Visibility"
                  value={tf.visibility || 'all'}
                  onChange={(v) => setParams({ vis: v === 'all' ? null : v })}
                  options={[
                    ['all', 'Any visibility'],
                    ['firm', 'Firm only'],
                    ['client', 'Client only'],
                    ['both', 'Both'],
                  ]}
                />
                <button type="button" className={'btn sm' + (tf.mine ? ' on' : '')} aria-pressed={tf.mine} title="Only the tasks you own" onClick={() => setParams({ mine: tf.mine ? null : '1' })}>
                  <Icon name="team" />
                  Mine
                </button>
              </>
            ) : null}
            {filtersOn ? (
              <button type="button" className="link" onClick={() => setParams({ state: null, status: null, urgency: null, vis: null, mine: null })}>
                Clear filters
              </button>
            ) : null}
          </div>

          {hasStat ? (
            data.loading ? (
              <div className="sec-load">Loading the register…</div>
            ) : data.error ? (
              <SecError message="Could not load the register. Please try again in a moment." onRetry={data.retry} />
            ) : shownFlat.length ? (
              <StatList groups={groups} rows={shownFlat} groupBy={groupBy} byId={book.byId} today={today} perClient={company === 'all'} />
            ) : (
              <Empty title={flat.length ? `No ${L[strip as Exclude<StripKey, ''>]?.toLowerCase() ?? ''} filings in view` : `No filings on the register for ${book.fyLabel}`} sub={flat.length ? 'Pick another state in the strip above.' : 'Rows arrive as each registration goes live. Until then the Calendar shows SBC’s own deadlines.'} />
            )
          ) : null}

          {hasNs ? (
            <>
              {cat === 'all' ? (
                <div className="mx-sub-h">
                  <h4 className="cob-h4">Non-statutory tasks</h4>
                  <span className="small">{tasksQ.isPending ? 'Loading…' : plural(shownTasks.length, 'task')}</span>
                </div>
              ) : null}
              {tasksQ.isPending ? (
                <div className="sec-load">Loading the tasks…</div>
              ) : tasksQ.isError ? (
                <SecError message="Could not load the tasks. Please try again in a moment." onRetry={() => void tasksQ.refetch()} />
              ) : shownTasks.length ? (
                <TaskList tasks={shownTasks} today={today} onOpen={(t) => go(H.task(t.id))} />
              ) : (
                <Empty
                  title={tasks.length ? 'No tasks match these filters' : 'No non-statutory tasks yet'}
                  sub={tasks.length ? 'Clear a filter to see the rest.' : canCreate ? 'Add one with New task: board packs, MIS, payroll runs and other internal work.' : 'Your manager adds them; they appear here with their dates and owner.'}
                />
              )}
            </>
          ) : null}

          <div className="mx-phleg cf-leg" aria-label="What the marks mean">
            {WORDS.map((w) => (
              <span key={w} title={w}>
                <WordPill word={w} sm />
              </span>
            ))}
          </div>
        </section>

        <div className="mx-col cob-rail">
          <Panel title="This month" sub={cat === 'stat' ? `Where ${monthLabel(today)}’s filings stand` : `Where the ${cat === 'ns' ? 'tasks' : 'items'} in view stand`}>
            <div className="cob-flow">
              {flowSteps.map(([label, n]) => (
                <div key={label} className="cob-flowi">
                  <b className="num">{data.loading ? '–' : n}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </Panel>
          <RailPanel title={cat === 'stat' ? `Due in the next ${SOON_DAYS} days` : cat === 'ns' ? 'This week' : 'Due soon'} items={soonItems} empty="Nothing is due soon." loading={data.loading} />
          <RailPanel title="Waiting on client" items={waitingItems} empty="Nothing is waiting on a client." loading={data.loading} />
          <RailPanel title={cat === 'stat' ? 'Filed recently' : 'Done recently'} items={doneItems} empty="Nothing has been finished yet." loading={data.loading} />
        </div>
      </div>
    </>
  );
}

const monthLabel = (iso: string) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(iso.slice(5, 7)) - 1];

/* ================================================================ statutory list */

function StatList({ groups, rows, groupBy, byId, today, perClient }: { groups: ObGroup[]; rows: FlatRow[]; groupBy: GroupBy; byId: Record<string, BookClient>; today: string; perClient: boolean }) {
  const { go, base } = useConsole();
  const H = hrefs(base);
  if (groupBy === 'filing') {
    return (
      <div>
        {groups
          .filter((g) => rows.some((x) => x.g.obligationId === g.obligationId))
          .map((g) => (
            <div key={g.obligationId} className="mx-fgrp">
              <button type="button" className={'cob-gh s-' + g.st} title={`${g.name} · open this obligation across your clients`} onClick={() => go(H.obligation(g.obligationId))}>
                <DTile iso={g.dueDate} red={g.st === 'o'} />
                <span className="mx-dt">
                  <b className="cf-ell">{g.name}</b>
                  <span className="cf-ell">{`Due ${dDay(g.dueDate, today)} · ${g.authority} · ${g.freqLabel}`}</span>
                </span>
                <LawTag area={g.area} tag={g.area} />
                <span className="cob-filled" title={`${g.filed} of ${g.total} clients have filed this period`}>
                  <b className="num">{`${g.filed} of ${g.total} filed`}</b>
                  <span className="mx-frm">
                    <i style={{ width: `${g.total ? (g.filed / g.total) * 100 : 0}%` }} />
                  </span>
                </span>
                <Icon name="chev" size={14} />
              </button>
              {rows
                .filter((x) => x.g.obligationId === g.obligationId)
                .map((x) => (
                  <ClientRow key={x.key} x={x} c={byId[x.r.clientId]} today={today} />
                ))}
            </div>
          ))}
      </div>
    );
  }
  const buckets: Array<{ id: string; label: string; area: AreaCode | null; rows: FlatRow[] }> =
    groupBy === 'law'
      ? AREA_ORDER.map((a) => ({ id: a, label: AREA_LABEL[a], area: a, rows: rows.filter((x) => x.g.area === a) }))
      : FREQ_BUCKETS.map(([k, label]) => ({ id: k, label, area: null, rows: rows.filter((x) => freqBucket(x.g.freq) === k) }));
  const other = rows.filter((x) => !buckets.some((b) => b.rows.includes(x)));
  if (other.length) buckets.push({ id: 'other', label: 'Other', area: null, rows: other });
  return (
    <div>
      <div className="cob-frow cob-th" aria-hidden="true">
        <span>Obligation</span>
        <span>Law</span>
        <span>Last filed</span>
        <span>Status</span>
        <span>Next due</span>
      </div>
      {buckets
        .filter((b) => b.rows.length)
        .map((b) => (
          <div key={b.id} className="mx-fgrp">
            <div className="mx-fgh2">
              {b.area ? <LawTag area={b.area} tag={b.area} /> : <i className="cf-sw" style={{ background: 'var(--ink-3)' }} />}
              <b>{b.label}</b>
              <span className="small">{plural(b.rows.length, 'filing')}</span>
            </div>
            {b.rows.map((x) => (
              <button key={x.key} type="button" className={'cob-frow s-' + x.r.st} title={`${x.g.name} · ${x.r.clientName} · open this period`} onClick={() => go(H.statutory(x.g.obligationId, x.key))}>
                <span className="mx-dt">
                  <b className="cf-ell">{x.g.name}</b>
                  <span className="cf-ell">{perClient ? `${x.r.clientName}${x.r.period ? ` · ${x.r.period}` : ''}` : x.r.period || x.g.freqLabel}</span>
                </span>
                <span>
                  <LawTag area={x.g.area} tag={x.g.area} />
                </span>
                <span className="small num">{x.lastFiled ? dShort(x.lastFiled, today) : '—'}</span>
                <span>
                  <WordPill word={x.word} sm />
                </span>
                <span className={'num small' + (x.r.st === 'o' ? ' red' : '')}>{x.nextDue ? dShort(x.nextDue, today) : x.r.filedOn ? 'Filed' : dShort(x.r.due, today)}</span>
              </button>
            ))}
          </div>
        ))}
    </div>
  );
}

function ClientRow({ x, c, today }: { x: FlatRow; c?: BookClient; today: string }) {
  const { go, base } = useConsole();
  const H = hrefs(base);
  const r = x.r;
  return (
    <button type="button" className={'cob-srow s-' + r.st} title={`${x.g.name} · ${r.clientName}${r.period ? ` · ${r.period}` : ''} · ${C_LABEL[r.st]} · open this period`} onClick={() => go(H.statutory(x.g.obligationId, x.key))}>
      <span className="mx-tc3">
        <ClientAv id={r.clientId} label={c?.initials ?? r.clientName.slice(0, 2).toUpperCase()} />
        <span>
          <b className="cf-ell">{c?.short ?? r.clientName}</b>
          <span className="small cf-ell">{c?.leadName ? `Lead ${c.leadName}` : r.period || 'No lead'}</span>
        </span>
      </span>
      <span className="small cf-ell" title="Who holds it on the register">
        {r.portal?.ownerName ?? '—'}
      </span>
      <span className="small num">{x.lastFiled ? dShort(x.lastFiled, today) : '—'}</span>
      <span>
        <WordPill word={x.word} sm />
      </span>
      <span className={'num small' + (r.st === 'o' ? ' red' : '')} title={C_TIP[r.st]}>
        {r.filedOn ? `Filed ${dShort(r.filedOn, today)}` : x.nextDue ? dShort(x.nextDue, today) : dShort(r.due, today)}
        {!r.filedOn && (r.st === 'o' || r.st === 'd') ? <small>{` · ${dueWords(r.days)}`}</small> : null}
      </span>
    </button>
  );
}

/* ================================================================ task list (S-3) */

function TaskList({ tasks, today, onOpen }: { tasks: TaskRowDto[]; today: string; onOpen: (t: TaskRowDto) => void }) {
  const groups = groupTasksByWeek(tasks).filter((g) => g.rows.length);
  return (
    <div>
      <div className="cob-trow cob-th" aria-hidden="true">
        <span>Task</span>
        <span>Start</span>
        <span>End</span>
        <span>Urgency</span>
        <span>Visibility</span>
        <span>Owner</span>
        <span>Reviewer</span>
        <span>Status</span>
      </div>
      {groups.map((g) => (
        <div key={g.key} className="mx-fgrp">
          <div className="mx-fgh2">
            <i className="cf-sw" style={{ background: WEEK_COLOR[g.key] }} />
            <b>{g.label}</b>
            <span className="small">{plural(g.rows.length, 'task')}</span>
          </div>
          {g.rows.map((t) => (
            <button key={t.id} type="button" className={'cob-trow' + (t.word === 'Overdue' ? ' s-o' : '')} title={`${t.title} · ${t.companyName} · open the task`} onClick={() => onOpen(t)}>
              <span className="mx-dt">
                <b className="cf-ell">{t.title}</b>
                <span className="cf-ell">{`${t.companyName}${t.checklist.total ? ` · ${t.checklist.done} of ${t.checklist.total} ticked` : ''}${t.attachmentCount ? ` · ${plural(t.attachmentCount, 'file')}` : ''}`}</span>
              </span>
              <span className="small num">{dShort(t.startDate, today)}</span>
              <span className={'small num' + (t.word === 'Overdue' ? ' red' : '')} title={t.word === 'Done' ? 'Done' : dueWords(t.daysToDue)}>
                {dShort(t.dueDate, today)}
              </span>
              <span>
                <UrgencyMark urgency={t.urgency as Urgency} />
              </span>
              <span>
                <VisMark visibility={t.visibility as Visibility} />
              </span>
              <span className="cob-cell">
                <PersonChip p={t.owner} role="owner" />
              </span>
              <span className="cob-cell">
                <PersonChip p={t.reviewer} role="reviewer" />
              </span>
              <span>
                <WordPill word={t.word as StatusWord} sm />
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ================================================================ rail */

interface RailItem {
  key: string;
  title: string;
  sub: string;
  right: string;
  red?: boolean;
  href: string;
}

const taskRail = (t: TaskRowDto, today: string, href: string): RailItem => ({
  key: `task-${t.id}`,
  title: t.title,
  sub: t.companyName,
  right: t.word === 'Done' ? `Done${t.completedAt ? ` ${dShort(t.completedAt.slice(0, 10), today)}` : ''}` : dShort(t.dueDate, today),
  red: t.word === 'Overdue',
  href,
});

function RailPanel({ title, items, empty, loading }: { title: string; items: RailItem[]; empty: string; loading: boolean }) {
  const { go } = useConsole();
  return (
    <Panel title={title} sub={loading ? 'Loading…' : items.length ? plural(items.length, 'item') : undefined}>
      {loading ? null : items.length ? (
        <div className="mx-rail">
          {items.map((i) => (
            <button key={i.key} type="button" className="mx-nrow cob-ri" title={`${i.title} · ${i.sub}`} onClick={() => go(i.href)}>
              <span className="mx-dt">
                <b className="cf-ell">{i.title}</b>
                <span className="cf-ell">{i.sub}</span>
              </span>
              <span className={'small num' + (i.red ? ' red' : '')}>{i.right}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className="small">{empty}</span>
      )}
    </Panel>
  );
}
