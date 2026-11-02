'use client';

/**
 * CLIENT OVERVIEW — /app/manager/projects/[slug] (prototype mxClientOverview,
 * a59q_mgr_pages.js): the dossier (who, where, how far, every action) beside
 * the journey (pick a phase, open a step), the timeline and the work.
 *
 * Every live function of the old project page (src/views/admin/ProjectDetail.tsx)
 * is here with the same API calls: the incorporation window (manager / admin
 * set it), the client's timeline change requests (Approve / Decline), the
 * pre-incorporation timeline, the phases with their doc-pack counts, the send
 * log with WhatsApp retry, "What SBC is doing" for the client's Home, and the
 * project settings menu. Plus the registered-office NOC (owner's request).
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { useDocPack } from '@/hooks/use-doc-pack';
import { buildClientTimeline, timelineStepsFromState, type TimelineBarView } from '@/lib/client-timeline';
import type { TimelineRequestDto } from '@/lib/client/client-home';
import { docPackPagePath } from '@/lib/doc-pack/paths';
import { apiFetch } from '@/lib/projects/engagements-db';
import { maskPhone } from '@/lib/notify/phone';
import { skipReasonText, whatsappErrorText } from '@/lib/notify/whatsapp-error-text';
import { canSetScheduleWindows, formatWindow } from '@/lib/projects/schedule-windows';
import { ENTITY_LEGAL_FORM_LABEL } from '@/lib/compliance/types';
import { COMPOSE_OUTGOING_EMAIL_EVENT } from '@/lib/toast-errors';
import { emailSchema } from '@/lib/api/schemas';
import type { PortalStep } from '@/lib/client-portal/step-model';
import { useConsole, useCrumbs } from '../../runtime';
import { Drill, type DrillRow } from '../../overlays';
import { Btn, ClientAv, Donut, Icon, Panel, Seg, StageTag, hueOf } from '../../ui';
import { buildClientView, companyInitials, dayDiff, PHASE_SHORT, plural, stepCode, STEP_STATE_COLOR, STEP_STATE_LABEL, stepStateOf, type ClientView } from './model';
import { dShort, NotFound, ProjectMenu, stamp, StatusBrief, StepWhatDrawer, useFullChecklist, usePeople, useRouteEngagement, useToday, WindowEditor, useClientPaths } from './shared';
import { NocPanel } from './noc';
import { SpiceAttachmentsPanel } from './SpiceAttachmentsPanel';

export function ClientOverviewPage() {
  const paths = useClientPaths();
  const { eng, param, settled } = useRouteEngagement();
  const router = useRouter();
  useCrumbs(['Clients', eng?.companyName ?? '…']);
  // An id or an old slug in the URL lands on the canonical one (live ProjectDetail redirect).
  useEffect(() => {
    if (eng?.slug && param !== eng.slug) router.replace(paths.project(eng) + window.location.hash);
  }, [eng, param, router]);
  if (!eng) return <NotFound settled={settled} />;
  return <Overview key={eng.id} eng={eng} />;
}

function Overview({ eng }: { eng: Engagement }) {
  const paths = useClientPaths();
  const { user } = useApp();
  const { go, openPop, openModal, openDrawer, seat } = useConsole();
  // Live EngagementDetail: a lead (intern) gets the intern overview — CC list, timeline, phases, documents; no
  // decisions, timeline requests, "What SBC is doing", send log, dates or project edits.
  const isLead = seat === 'lead' || user?.role === 'intern';
  const today = useToday();
  const people = usePeople();
  const { state, refreshing } = useFullChecklist(eng);
  const v = useMemo(() => buildClientView(eng, state, people, today, isLead ? 'lead' : 'mgr'), [eng, state, people, today, isLead]);
  const pack = useDocPack(eng.id);
  const base = paths.project(eng);
  const canWindow = !isLead && canSetScheduleWindows(user?.role);

  // the anchor a step page links to ("#cx-timeline", "#cx-noc")
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    return () => clearTimeout(t);
  }, []);

  const pct = v.model.all.total ? Math.round((v.model.all.done / v.model.all.total) * 100) : 0;
  const rowsOf = (want: (s: PortalStep) => boolean): DrillRow[] =>
    v.model.steps.filter(want).map((s) => {
      const st = stepStateOf(s);
      return {
        id: s.id,
        title: s.title,
        meta: `${PHASE_SHORT[s.phaseNo - 1]} · ${stepCode(s.id)}`,
        state: st === 'done' ? (s.doneOn ? dShort(s.doneOn) : 'Done') : st === 'stuck' ? `${s.lateDays}d late` : s.due ? `due ${dShort(s.due)}` : STEP_STATE_LABEL[st],
        color: STEP_STATE_COLOR[st],
        onOpen: () => go(paths.step(eng, s.id)),
      };
    });
  const ringDrill = (_i: number, el: Element) =>
    openPop(
      el,
      <Drill
        title={`${eng.companyName} · ${v.model.all.total} steps`}
        sub={`${v.model.all.done} done · ${pct}%`}
        tabs={[
          { label: 'Done', color: 'var(--mx-ok)', rows: rowsOf((s) => s.kind === 'done') },
          { label: 'Current', color: 'var(--mx-run)', rows: rowsOf((s) => s.kind === 'you' || s.kind === 'prog' || s.kind === 'with') },
          { label: 'Upcoming', color: 'var(--mx-none)', rows: rowsOf((s) => s.kind === 'up' || s.kind === 'next') },
        ]}
        active={1}
      />,
      { kind: 'drill' },
    );

  const coiFact = (() => {
    if (eng.incorporationDate) return { v: `Issued ${dShort(eng.incorporationDate)}`, t: 'Certificate of Incorporation date' };
    if (v.model.coiExpected) {
      const d = dayDiff(today, v.model.coiExpected);
      return { v: d >= 0 ? plural(d, 'day') : `${-d} days past`, t: `The incorporation window ends ${dShort(v.model.coiExpected)}` };
    }
    return { v: 'No window set', t: 'Set the incorporation window under Timeline' };
  })();

  const contactFirst = (eng.clientDisplayName ?? '').trim().split(/\s+/)[0];
  const email = () => {
    if (!eng.clientEmail) return;
    window.dispatchEvent(
      new CustomEvent(COMPOSE_OUTGOING_EMAIL_EVENT, {
        detail: { to: [eng.clientEmail], subject: `${eng.companyName} · update`, html: '', text: '', engagementId: eng.id, companyName: eng.companyName },
      }),
    );
  };
  const docsReady = pack.data ? `${pack.data.counts.ready}/${pack.data.total}` : '';

  return (
    <div className="mx-cov">
      {/* the dossier: who, where, how far, and every action, in one column that stays in view */}
      <aside className="glass mx-dos" style={{ ['--cc' as string]: hueOf(eng.id) }}>
        <div className="mx-dos-top">
          <button type="button" className="ib sm" aria-label="Back to clients" title="Back to clients" onClick={() => go(paths.list)}>
            <Icon name="back" />
          </button>
          <StageTag need={v.stage} />
          <span className="sp" />
          <span className="small" title={`Set up on ${dShort(eng.createdAt?.slice(0, 10))}`}>
            Day {v.day}
          </span>
          <ProjectMenu eng={eng} onDeleted={() => go(paths.list)} />
        </div>
        <div className="mx-dos-id">
          <ClientAv id={eng.id} label={companyInitials(eng.companyName)} big />
          <h2>{eng.companyName}</h2>
          <span className="small">
            {[
              ENTITY_LEGAL_FORM_LABEL[eng.entityLegalForm ?? 'company'],
              eng.ownershipType === 'independent' ? 'Standalone' : eng.companyType === 'foreign' ? 'Foreign subsidiary' : 'Indian subsidiary',
              v.leads.length ? `lead ${v.leads.map((l) => l.name).join(', ')}` : 'no lead yet',
            ].join(' · ')}
          </span>
        </div>
        <div className="mx-dos-ring">
          <Donut
            parts={[
              { n: v.model.all.done, color: 'var(--mx-ok)', label: 'Done' },
              { n: v.model.all.total - v.model.all.done, color: 'var(--line)', label: 'Left' },
            ]}
            size={112}
            onPick={ringDrill}
            center={[`${pct}%`, `of ${v.model.all.total}`]}
          />
          <div className="mx-dos-f">
            <div title={v.current ? `${stepCode(v.current.id)} ${v.current.title}` : undefined}>
              <span>Now</span>
              <b>{v.current ? `${stepCode(v.current.id)} ${v.current.title}` : v.holder.long}</b>
            </div>
            <div title="Who holds the current step, and for how long">
              <span>Ball</span>
              <b>{ballText(v)}</b>
            </div>
            <div title={coiFact.t}>
              <span>To COI</span>
              <b>{coiFact.v}</b>
            </div>
            <div title={v.health.why}>
              <span>Health</span>
              <b style={{ color: v.health.color }}>{v.health.label}</b>
            </div>
          </div>
        </div>
        <div className="mx-dos-c">
          <span className="eyebrow">Contact</span>
          <b>{eng.clientDisplayName || 'No contact name'}</b>
          {eng.clientEmail ? (
            <a className="link" href={`mailto:${eng.clientEmail}`}>
              {eng.clientEmail}
            </a>
          ) : (
            <span className="small">No portal sign-in yet</span>
          )}
          {isLead ? <ProgressCc engagementId={eng.id} /> : null}
        </div>
        <div className="mx-dos-a">
          {eng.clientEmail ? (
            <Btn cls="pri" ico="mail" onClick={email}>
              {contactFirst ? `Email ${contactFirst}` : 'Email the client'}
            </Btn>
          ) : null}
          <Btn ico="brief" onClick={() => openModal(<StatusBrief v={v} />, { cls: 'wide', label: 'Status brief' })}>
            Status brief
          </Btn>
          <Btn ico="doc" onClick={() => go(paths.boardResolution(eng))}>
            Board resolution
          </Btn>
          <Btn ico="folder" onClick={() => go(`${base}/documents`)}>
            {docsReady ? `Documents ${docsReady}` : 'Documents'}
          </Btn>
          {isLead ? null : (
            <Btn ico="notes" onClick={() => go(`${base}/edit`)}>
              Edit project
            </Btn>
          )}
        </div>
      </aside>

      <div className="mx-col">
        {isLead ? null : <Waiting v={v} />}
        {isLead ? null : <TimelineRequests eng={eng} canDecide={canWindow} />}
        <Journey v={v} refreshing={refreshing} onWhat={(s) => openDrawer(<StepWhatDrawer item={s.item} eng={eng} />)} />
        {isLead ? (
          <Timeline eng={eng} state={state} canWindow={false} viewer="intern" />
        ) : (
          <div className="mx-row11">
            <Timeline eng={eng} state={state} canWindow={canWindow} viewer="client" />
            <WorkItems eng={eng} />
          </div>
        )}
        <NocPanel eng={eng} />
        <SpiceAttachmentsPanel eng={eng} />
        {user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin' ? <SendLog eng={eng} /> : null}
      </div>
    </div>
  );
}

/** Dossier 'Ball': '24d with the client', '17d with Divya', '3d with you', '2d with MCA'. */
function ballText(v: ClientView): string {
  const h = v.holder;
  if (h.who === 'none') return '—';
  const who = h.who === 'client' ? 'the client' : h.who === 'you' ? 'you' : h.who === 'mca' ? 'MCA' : h.label;
  return h.days !== undefined ? `${h.days}d with ${who}` : `With ${who}`;
}

/* ---------------------------------------------------------------- waiting on you */

function Waiting({ v }: { v: ClientView }) {
  const paths = useClientPaths();
  const { go } = useConsole();
  if (!v.approvals.length) return null;
  return (
    <section className="glass panel mx-p cx-wait">
      <div className="ph">
        <div className="mx-pt">
          <h3>{v.approvals.length === 1 ? '1 step waits for your decision' : `${v.approvals.length} steps wait for your decision`}</h3>
          <span className="small">Open the step to approve, send back, or approve and send to the client</span>
        </div>
      </div>
      {v.approvals.map((a) => {
        const s = v.model.byId[a.itemId];
        return (
          <button key={`${a.itemId}-${a.kind}`} type="button" className="mx-qi cx-qbtn" onClick={() => go(paths.step(v.e, a.itemId))}>
            <span className="mx-code">{stepCode(a.itemId)}</span>
            <span className="mx-dt">
              <b>{s?.title ?? a.itemId}</b>
              <span>{a.kind}</span>
            </span>
            <span className="pill due">Needs you</span>
            <Icon name="chev" size={14} />
          </button>
        );
      })}
    </section>
  );
}

/* ---------------------------------------------------------------- journey */

const PH_KEY = 'vcfo-console-client-phase';

function Journey({ v, refreshing, onWhat }: { v: ClientView; refreshing: boolean; onWhat: (s: PortalStep) => void }) {
  const paths = useClientPaths();
  const { go } = useConsole();
  const pack = useDocPack(v.e.id);
  const curPh = Math.max(0, (v.current?.phaseNo ?? 1) - 1);
  const [ph, setPh] = useState<number>(curPh);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PH_KEY) ?? '{}') as Record<string, number>;
      if (typeof saved[v.e.id] === 'number') setPh(saved[v.e.id]!);
    } catch {
      /* storage unavailable */
    }
  }, [v.e.id]);
  const pick = (i: number) => {
    setPh(i);
    try {
      const saved = JSON.parse(sessionStorage.getItem(PH_KEY) ?? '{}') as Record<string, number>;
      saved[v.e.id] = i;
      sessionStorage.setItem(PH_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable */
    }
  };
  const phase = v.model.phases[ph]!;
  const part = ph === 0 ? 'part-a' : ph === 1 ? 'part-b' : null;
  const partItems = part && pack.data ? pack.data.items.filter((i) => i.part === part) : [];
  const partReady = partItems.filter((i) => i.status === 'ready').length;

  return (
    <Panel
      title="Journey"
      sub={`4 phases · ${v.model.all.total} steps · pick a phase, open a step`}
      act={<span className="small">{refreshing ? 'Syncing…' : `${v.model.all.done} of ${v.model.all.total} done`}</span>}
    >
      <div className="mx-jbar" role="group" aria-label="Phases">
        {v.model.phases.map((p, i) => {
          const st = p.state === 'done' ? 'done' : p.state === 'up' ? 'up' : 'cur';
          return (
            <button
              key={p.id}
              type="button"
              className={'mx-jseg ' + st + (i === ph ? ' on' : '')}
              style={{ flex: p.total }}
              aria-pressed={i === ph}
              title={`${p.title} · ${p.done} of ${p.total} done`}
              onClick={() => pick(i)}
            >
              <span className="mx-jfill">
                <i style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
              </span>
              <b>{`${i + 1} · ${PHASE_SHORT[i]}`}</b>
              <span>{`${p.done} of ${p.total} · ${st === 'done' ? 'done' : st === 'cur' ? 'in progress' : 'upcoming'}`}</span>
            </button>
          );
        })}
      </div>
      <div className="mx-steps">
        {phase.steps.map((s) => {
          const st = stepStateOf(s);
          const date =
            st === 'done' || st === 'na'
              ? s.doneOn
                ? dShort(s.doneOn)
                : st === 'na'
                  ? 'Not needed'
                  : 'Done'
              : st === 'stuck'
                ? `${s.lateDays}d late`
                : s.due && (st === 'cur' || s.ownWindow)
                  ? `due ${dShort(s.due)}`
                  : '';
          return (
            <div
              key={s.id}
              role="link"
              tabIndex={0}
              className={'mx-step ' + (st === 'na' ? 'done' : st)}
              title={`${stepCode(s.id)} ${s.title} · ${STEP_STATE_LABEL[st]}`}
              onClick={() => go(paths.step(v.e, s.id))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') go(paths.step(v.e, s.id));
              }}
            >
              <i className={'mx-si2 ' + (st === 'na' ? 'done' : st)}>
                {st === 'done' || st === 'na' ? <Icon name="check" size={11} /> : st === 'stuck' ? <Icon name="alert" size={11} /> : null}
              </i>
              <span className="mx-code">{stepCode(s.id)}</span>
              <b>{s.title}</b>
              <button
                type="button"
                className="mx-what"
                onClick={(e) => {
                  e.stopPropagation();
                  onWhat(s);
                }}
              >
                What&apos;s this?
              </button>
              <span className={'small' + (st === 'stuck' ? ' cx-late' : '')}>{date}</span>
              <Icon name="chev" size={14} />
            </div>
          );
        })}
      </div>
      <div className="mx-jfoot">
        {part ? (
          <button type="button" className="link" onClick={() => go(paths.docs(v.e, part))} title="Open this part of the document pack">
            {pack.data ? `Documents for this phase: ${partReady} of ${partItems.length} ready` : 'Documents for this phase'}
          </button>
        ) : (
          <span className="small">{`${phase.done} of ${phase.total} done in ${phase.title.replace(/^Phase\s+\d+\s+[—-]\s+/, '')}`}</span>
        )}
        <span className="sp" />
        <div className="mx-leg cx-leg" aria-label="What the marks mean">
          {(['done', 'cur', 'stuck', 'up'] as const).map((k) => (
            <span key={k} className="cx-lk">
              <i className={'mx-si2 ' + k} />
              {STEP_STATE_LABEL[k]}
            </span>
          ))}
        </div>
        {ph > 0 ? (
          <Btn cls="sm" ico="back" onClick={() => pick(ph - 1)}>
            Previous phase
          </Btn>
        ) : null}
        {ph < v.model.phases.length - 1 ? (
          <Btn cls="sm" ico="chev" onClick={() => pick(ph + 1)}>
            Next phase
          </Btn>
        ) : null}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- timeline (live ProjectTimeline data) */

const TONE_CLASS: Record<TimelineBarView['tone'], string> = { done: 'done', current: 'cur', waiting: 'cur', upcoming: 'up' };
/** The staff words for a bar (the live chart reads it as the client: "Waiting for you"). */
const TONE_WORD: Record<TimelineBarView['tone'], string> = { done: 'Done', current: 'In progress', waiting: 'Waiting on the client', upcoming: 'Not started' };

/** Live ProjectTimeline: the manager's page reads it as the client (viewer 'client'), the lead's as the lead ('intern'). */
function Timeline({ eng, state, canWindow, viewer }: { eng: Engagement; state: Record<string, unknown>; canWindow: boolean; viewer: 'client' | 'intern' }) {
  const { openPop } = useConsole();
  const model = useMemo(
    () =>
      buildClientTimeline({
        steps: timelineStepsFromState(state as Parameters<typeof timelineStepsFromState>[0], viewer),
        schedule: eng.schedule,
        startDate: eng.createdAt,
      }),
    [state, eng.schedule, eng.createdAt, viewer],
  );
  const inc = eng.schedule?.incorporation;
  return (
    <Panel
      id="cx-timeline"
      title="Timeline"
      sub={inc ? `Incorporation window ${formatWindow(inc)} · you set the dates, the lead runs them` : 'No incorporation window set yet · you set the dates, the lead runs them'}
      need="inc"
      act={
        canWindow ? (
          <Btn
            cls="sm"
            ico="cal"
            onClick={(e) => openPop(e.currentTarget, <WindowEditor eng={eng} target={{ kind: 'incorporation' }} label="Incorporation" value={inc} />)}
          >
            {inc ? 'Edit dates' : 'Set dates'}
          </Btn>
        ) : undefined
      }
    >
      <div className="mx-ctl cx-ctl">
        {model.bars.map((b) => (
          <div key={b.id} className="mx-ctr" title={`${b.label} · ${b.rangeLabel} · ${TONE_WORD[b.tone]}`}>
            <span className="mx-ctn">
              <b className="cx-ell">{b.label}</b>
              <span className="cx-ell">{`${b.rangeLabel} · ${TONE_WORD[b.tone]}`}</span>
            </span>
            <div className="mx-ctt">
              {b.milestone ? (
                <span className="mx-coid" style={{ left: `${b.left}%` }} />
              ) : (
                <span className={'mx-ctb ' + TONE_CLASS[b.tone]} style={{ left: `${b.left}%`, width: `${Math.max(b.width, 1.5)}%` }} />
              )}
            </div>
          </div>
        ))}
        {model.todayLeft !== null ? (
          <div className="mx-gnow" style={{ left: `calc(190px + 12px + (100% - 202px) * ${model.todayLeft / 100})` }}>
            <span>Today</span>
          </div>
        ) : null}
      </div>
      <div className="cx-axis" aria-hidden="true">
        {model.ticks.map((t) => (
          <span key={`${t.label}-${t.left}`} style={{ left: `calc(202px + (100% - 202px) * ${t.left / 100})` }}>
            {t.label}
          </span>
        ))}
      </div>
      {model.sharedNote ? <p className="small cx-note">{model.sharedNote}</p> : null}
      <div className="mx-leg cx-leg" aria-label="What the bars mean">
        <span className="cx-lk">
          <i className="cx-sw" style={{ background: 'var(--mx-ok)' }} />
          Done
        </span>
        <span className="cx-lk">
          <i className="cx-sw" style={{ background: 'var(--mx-run)' }} />
          In progress
        </span>
        <span className="cx-lk">
          <i className="cx-sw" style={{ background: 'var(--line)' }} />
          Upcoming
        </span>
        <span className="cx-lk">
          <i className="cx-sw cx-dia" />
          COI target
        </span>
        <span className="cx-lk">
          <i className="cx-sw" style={{ background: 'var(--over)', width: 3 }} />
          Today
        </span>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- timeline change requests (live TimelineRequestsPanel) */

function TimelineRequests({ eng, canDecide }: { eng: Engagement; canDecide: boolean }) {
  const { toast } = useConsole();
  const qc = useQueryClient();
  const key = ['timeline-requests', eng.id];
  const [note, setNote] = useState('');
  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/timeline-requests`);
      if (!res.ok) return [] as TimelineRequestDto[];
      return ((await res.json()) as { requests: TimelineRequestDto[] }).requests;
    },
  });
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => {
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/timeline-requests/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not save the decision');
      return decision;
    },
    onSuccess: (decision) => {
      toast(decision === 'approve' ? 'Timeline updated' : 'Request declined');
      setNote('');
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['engagements'] });
    },
    onError: (e: Error) => toast(e.message),
  });
  const pending = (list.data ?? []).filter((r) => r.status === 'pending');
  if (!pending.length) return null;
  return (
    <section className="glass panel mx-p cx-tlreq">
      <div className="ph">
        <div className="mx-pt">
          <h3>The client asked for a timeline change</h3>
          <span className="small">{canDecide ? 'Approving writes the new dates into the schedule' : 'Waiting for the project manager to decide'}</span>
        </div>
        <span className="sp" />
        <span className="pill due">Needs you</span>
      </div>
      {pending.map((r) => (
        <div key={r.id} className="cx-tlr">
          <p>
            <b>{r.requestedByName ?? 'Client'}</b>: “{r.reason}”{r.slipDays ? ` · COI moves ${r.slipDays > 0 ? '+' : ''}${r.slipDays} days` : ''}
            <span className="small"> · {stamp(r.createdAt)}</span>
          </p>
          <div className="cx-tlph">
            {r.phases.map((p) => (
              <span key={p.id} className="pill mut">
                {`${p.name}: ${dShort(p.from)} → ${dShort(p.to)}`}
              </span>
            ))}
          </div>
          {canDecide ? (
            <div className="cx-tlact">
              <input className="mx-in" value={note} placeholder="Note to the client (optional)" aria-label="Note to the client" onChange={(e) => setNote(e.target.value)} />
              <Btn cls="sm" ico="x" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'reject' })}>
                Decline
              </Btn>
              <Btn cls="sm pri" ico="check" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'approve' })}>
                Approve and update the timeline
              </Btn>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/* ---------------------------------------------------------------- "What SBC is doing" (live WorkItemsPanel) */

interface WorkItem {
  id: string;
  title: string;
  progressPct: number;
  readyOn?: string;
  status: string;
}

function WorkItems({ eng }: { eng: Engagement }) {
  const { toast } = useConsole();
  const qc = useQueryClient();
  const key = ['work-items', eng.id];
  const [title, setTitle] = useState('');
  const [readyOn, setReadyOn] = useState('');
  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/client/home/work-items?engagementId=${encodeURIComponent(eng.id)}`);
      if (!res.ok) return [] as WorkItem[];
      return ((await res.json()) as { items: WorkItem[] }).items;
    },
  });
  const save = useMutation({
    mutationFn: async (body: Partial<WorkItem> & { title: string }) => {
      const res = await fetch('/api/client/home/work-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ engagementId: eng.id, ...body, readyOn: body.readyOn || undefined }),
      });
      if (!res.ok) throw new Error('Could not save');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast(e.message),
  });
  const items = list.data ?? [];
  return (
    <Panel title="What SBC is doing" sub="The client sees these on Home with % done; without any, Home lists the steps SBC holds">
      {list.isPending ? (
        <p className="small">Loading…</p>
      ) : items.length ? (
        <div className="cx-wi">
          {items.map((it) => (
            <div key={it.id} className={'cx-wir' + (it.status === 'done' ? ' done' : '')}>
              <span className="mx-dt">
                <b className="cx-ell" title={it.title}>
                  {it.title}
                </b>
                <span>{it.readyOn ? `ready ${dShort(it.readyOn)}` : 'No ready date'}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                defaultValue={it.progressPct}
                aria-label={`${it.title} · % done`}
                onMouseUp={(e) => save.mutate({ ...it, progressPct: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={(e) => save.mutate({ ...it, progressPct: Number((e.target as HTMLInputElement).value) })}
              />
              <b className="cx-num">{it.progressPct}%</b>
              <Btn cls="sm" onClick={() => save.mutate({ ...it, status: it.status === 'done' ? 'active' : 'done' })}>
                {it.status === 'done' ? 'Reopen' : 'Done'}
              </Btn>
              <button type="button" className="ib sm" aria-label={`Remove ${it.title}`} title="Remove" onClick={() => save.mutate({ ...it, status: 'hidden' })}>
                <Icon name="x" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="small">Nothing listed. Add what the team is working on so the client sees it on Home.</p>
      )}
      <form
        className="mx-addrow cx-wiadd"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          save.mutate({ title: title.trim(), readyOn, progressPct: 0 });
          setTitle('');
          setReadyOn('');
        }}
      >
        <input className="mx-in" value={title} placeholder="e.g. Drafting the MOA" aria-label="What the team is doing" onChange={(e) => setTitle(e.target.value)} />
        <input className="mx-in cx-date" type="date" value={readyOn} aria-label="Ready on" onChange={(e) => setReadyOn(e.target.value)} />
        <Btn type="submit" cls="sm pri" ico="check" disabled={!title.trim() || save.isPending}>
          Add
        </Btn>
      </form>
    </Panel>
  );
}

/* ---------------------------------------------------------------- send log (live SendLogPanel) */

type DeliveryRow = {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  toAddress: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  retryOf: string | null;
  createdAt: string;
};

const EVENT_LABEL: Record<string, string> = {
  welcome: 'Welcome',
  coi_issued: 'Certificate issued',
  document_delivered: 'Document delivered',
  compliance_due_monthly: 'Monthly filing due',
  compliance_due_quarterly: 'Quarterly filing due',
  compliance_overdue: 'Filing overdue',
  step_awaiting_approval: 'Ready for approval',
  phase_approved: 'Step approved',
  client_action_needed: 'Details needed',
  documents_shared: 'Documents shared',
  staff_client_submitted: 'Client submitted',
  staff_client_uploaded: 'Client uploaded',
  staff_change_requested: 'Change requested',
  process_notice: 'Process update',
};

const STATUS_PILL: Record<string, string> = { queued: 'mut', sent: 'up', delivered: 'done', read: 'done', failed: 'over', skipped: 'due' };
const STATUSES = ['all', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped'] as const;

function reasonFor(row: DeliveryRow): string {
  if (row.status === 'skipped') return skipReasonText(row.skipReason) ?? '';
  if (row.status === 'failed') return row.channel === 'whatsapp' ? whatsappErrorText(row.errorCode) : row.errorCode ?? 'Failed';
  return '';
}
function toFor(row: DeliveryRow): string {
  const who = row.recipientName?.trim() || row.recipientEmail || '—';
  if (row.channel === 'whatsapp') {
    const masked = maskPhone(row.toAddress);
    return masked ? `${who} · ${masked}` : who;
  }
  return row.toAddress && row.toAddress !== who ? `${who} · ${row.toAddress}` : who;
}

function SendLog({ eng }: { eng: Engagement }) {
  const { toast } = useConsole();
  const qc = useQueryClient();
  const key = ['notification-deliveries', eng.id] as const;
  const [channel, setChannel] = useState<'all' | 'email' | 'whatsapp'>('all');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await apiFetch<{ deliveries: DeliveryRow[] }>(`/api/engagements/${encodeURIComponent(eng.id)}/notification-deliveries`, { fallbackError: 'Could not load the send log.' })).deliveries,
    staleTime: 15_000,
  });
  const retry = useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch<{ ok: true }>(`/api/engagements/${encodeURIComponent(eng.id)}/notification-deliveries/${deliveryId}/retry`, { method: 'POST', fallbackError: 'Could not retry this message.' }),
    onSuccess: async () => {
      toast('Retry queued · the send log updates once WhatsApp answers');
      await qc.invalidateQueries({ queryKey: key });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Retry failed'),
  });
  const rows = (query.data ?? []).filter((r) => (channel === 'all' || r.channel === channel) && (status === 'all' || r.status === status));
  return (
    <Panel
      title="Send log"
      sub={query.data ? `What the app sent for this project · ${rows.length} of ${query.data.length}` : 'What the app sent for this project, on which channel, and what happened'}
      act={
        <div className="cx-slf">
          <Seg<'all' | 'email' | 'whatsapp'>
            options={[
              { value: 'all', label: 'All' },
              { value: 'email', label: 'Email' },
              { value: 'whatsapp', label: 'WhatsApp' },
            ]}
            value={channel}
            onChange={setChannel}
            ariaLabel="Filter by channel"
          />
          <select className="lsel" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Every status' : s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {query.isPending ? (
        <p className="small">Loading the send log…</p>
      ) : query.isError ? (
        <div className="sec-err">
          <Icon name="alert" />
          <span>The send log could not load.</span>
          <span className="sp" />
          <button type="button" className="btn sm" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="small">{query.data.length === 0 ? 'Nothing has been sent for this project yet.' : 'No messages match these filters.'}</p>
      ) : (
        <div className="cx-scroll">
          <div className="mx-table cx-slt">
            <div className="mx-th">
              <span>Time</span>
              <span>Channel</span>
              <span>Event</span>
              <span>To</span>
              <span>Status</span>
              <span>Reason</span>
              <span />
            </div>
            {rows.map((r) => (
              <div key={r.id} className="mx-tr static">
                <span className="small cx-num">{stamp(r.createdAt)}</span>
                <span className="small">{r.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
                <span className="cx-ell" title={EVENT_LABEL[r.eventType] ?? r.eventType}>
                  {EVENT_LABEL[r.eventType] ?? r.eventType}
                  {r.retryOf ? <span className="small"> (retry)</span> : null}
                </span>
                <span className="cx-ell" title={toFor(r)}>
                  {toFor(r)}
                </span>
                <span>
                  <span className={'pill sm ' + (STATUS_PILL[r.status] ?? 'mut')}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</span>
                </span>
                <span className="small cx-ell" title={reasonFor(r) || undefined}>
                  {reasonFor(r) || '—'}
                </span>
                <span>
                  {r.channel === 'whatsapp' && r.status === 'failed' ? (
                    <Btn cls="sm" ico="send" disabled={retry.isPending && retry.variables === r.id} onClick={() => retry.mutate(r.id)}>
                      Retry
                    </Btn>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- progress email CC (live ProgressEmailCcSection, lead only) */

/**
 * The lead's CC list on client progress emails (live intern overview header):
 * GET/PATCH /api/engagements/:id/progress-cc, same checks (a valid address, no
 * duplicate, up to 10), the firm default CC noted when it is configured.
 */
function ProgressCc({ engagementId }: { engagementId: string }) {
  const { toast } = useConsole();
  const qc = useQueryClient();
  const key = ['progress-cc', engagementId];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  type Cc = { emails: string[]; defaultCcConfigured: boolean };
  const url = `/api/engagements/${encodeURIComponent(engagementId)}/progress-cc`;
  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Cc> => {
      const res = await fetch(url, { credentials: 'same-origin' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; emails?: string[]; defaultCcConfigured?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'load_failed');
      return { emails: data.emails ?? [], defaultCcConfigured: Boolean(data.defaultCcConfigured) };
    },
  });
  const save = useMutation({
    mutationFn: async (next: string[]): Promise<Cc> => {
      const res = await fetch(url, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; emails?: string[]; defaultCcConfigured?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const code = data.error ?? 'save_failed';
        throw new Error(
          code === 'too_many_cc' ? 'You can add up to 10 CC emails per project.' : code === 'invalid_email' ? 'Check the address and try again.' : 'Could not save the CC list. Try again in a moment.',
        );
      }
      return { emails: data.emails ?? [], defaultCcConfigured: Boolean(data.defaultCcConfigured) };
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      toast('CC list updated · progress emails include these addresses');
    },
    onError: (e: Error) => toast(e.message),
  });
  const emails = q.data?.emails ?? [];
  const close = () => {
    setAdding(false);
    setDraft('');
    setErr('');
  };
  const add = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) return setErr('Enter a valid email address.');
    if (emails.includes(parsed.data)) return setErr('That address is already on this project.');
    if (emails.length >= 10) return setErr('Maximum 10 additional CC addresses per project.');
    save.mutate([...emails, parsed.data], { onSuccess: close });
  };
  return (
    <div className="mx-cc2" title={q.data?.defaultCcConfigured ? 'Copied on client progress emails · the firm default CC is always included' : 'Copied on client progress emails for this project'}>
      <span className="small">CC</span>
      {q.isPending ? (
        <span className="small">Loading…</span>
      ) : q.isError ? (
        <button type="button" className="link" onClick={() => void q.refetch()}>
          Could not load · try again
        </button>
      ) : (
        <>
          {emails.map((e) => (
            <span key={e} className="pill mut cx-ccchip" title={e}>
              <span className="cx-ell">{e}</span>
              <button type="button" aria-label={`Remove ${e}`} disabled={save.isPending} onClick={() => save.mutate(emails.filter((x) => x !== e))}>
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
          {adding ? (
            <span className="cx-ccadd">
              <input
                className="mx-in"
                type="email"
                value={draft}
                placeholder="name@firm.com"
                aria-label="Add CC email"
                disabled={save.isPending}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setErr('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    close();
                  }
                }}
              />
              <button type="button" className="link" disabled={save.isPending || !draft.trim()} onClick={add}>
                Add
              </button>
            </span>
          ) : (
            <button type="button" className="link" onClick={() => setAdding(true)}>
              + Add
            </button>
          )}
        </>
      )}
      {err ? <span className="cx-err cx-ccerr">{err}</span> : null}
    </div>
  );
}
