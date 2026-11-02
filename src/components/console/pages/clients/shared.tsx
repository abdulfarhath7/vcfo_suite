'use client';

/**
 * Clients chain — pieces shared by the six pages (Clients, client overview,
 * step, documents, edit, new project): route → engagement, the full checklist,
 * the Tailwind island for live components, holder / health marks, the date
 * window editor, "What's this?" and the status brief.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItem } from '@/data/checklist';
import { ProjectActionsMenu } from '@/components/admin/ProjectActionsMenu';
import { resolveEngagementFromRouteParam, engagementRouteParamFromParams } from '@/lib/slug';
import { setEngagementWindowInDb } from '@/lib/projects/engagements-db';
import { formatWindow, isValidWindowRange } from '@/lib/projects/schedule-windows';
import { stepDescription, stepNeeds, stepTimeline } from '@/components/portal/sections/incorporation/model';
import { fmt, fmtY, todayIso } from '@/components/portal/dates';
import { useConsole } from '../../runtime';
import { DrawerHead, ModalBody, PopHead } from '../../overlays';
import { Btn, Icon } from '../../ui';
import { clientPaths, HEALTH_COLOR, holderPillKind, holderText, PHASE_SHORT, phaseNoOf, plural, stepCode, type ClientPaths, type ClientSeat, type ClientView, type Health, type Holder } from './model';
import '../../css/96-clients.css';
import '../../css/96-clients-tw.css';

/** The Clients chain's links for this seat (manager: /app/manager/projects…, lead: /app/intern/clients, /app/intern/projects…). */
export function useClientPaths(): ClientPaths {
  const { base } = useConsole();
  return useMemo(() => clientPaths(base), [base]);
}

/** The seat in the Clients chain's terms: the project lead's console, or the manager's. */
export function useClientSeat(): ClientSeat {
  return useConsole().seat === 'lead' ? 'lead' : 'mgr';
}

/* ---------------------------------------------------------------- dates */

export function useToday(): string {
  return useMemo(() => todayIso(), []);
}

/** "16 Oct" this year, "16 Oct 2025" otherwise (README words). */
export function dShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  return d.slice(0, 4) === todayIso().slice(0, 4) ? fmt(d) : fmtY(d);
}

/** "2:30 pm" from an ISO timestamp, in India time. */
export function tShort(ts?: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).replace(/\s?(AM|PM)$/i, (m) => ' ' + m.trim().toLowerCase());
}

/** "16 Oct, 2:30 pm" */
export function stamp(ts?: string | null): string {
  if (!ts) return '—';
  const day = todayIso(new Date(ts).getTime());
  return `${dShort(day)}, ${tShort(ts)}`;
}

/* ---------------------------------------------------------------- people */

export function usePeople(): { id: string; name: string; initials: string }[] {
  const { internOptions, teamMembers } = useApp();
  return internOptions.length ? internOptions : teamMembers;
}

/* ---------------------------------------------------------------- route → engagement */

/** The engagement in the URL (`[slug]` or `[id]`), from the caller's own list. */
export function useRouteEngagement(): { eng?: Engagement; param: string; settled: boolean } {
  const params = useParams() as Record<string, string | string[] | undefined>;
  const param = engagementRouteParamFromParams(params);
  const { engagements, engagementsSettled } = useApp();
  const eng = useMemo(() => resolveEngagementFromRouteParam(engagements, param), [engagements, param]);
  return { eng, param, settled: engagementsSettled };
}

/**
 * The full checklist for one engagement (the list only carries the slim
 * index): reloads it once per engagement, as the live project page does.
 */
export function useFullChecklist(eng?: Engagement) {
  const { getStateForEngagement, refreshEngagementChecklist } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const id = eng?.id;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setRefreshing(true);
    void refreshEngagementChecklist(id).finally(() => {
      if (!cancelled) setRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, refreshEngagementChecklist]);
  const state = useMemo(() => (eng ? getStateForEngagement(eng) : {}), [eng, getStateForEngagement]);
  return { state, refreshing };
}

/* ---------------------------------------------------------------- the Tailwind island */

/**
 * Live Tailwind components inside the console (README: the client portal's
 * `.sw-tw` trick, here `.cx-tw`): the utilities they use are re-emitted under
 * `.cx-tw` (scripts/console-tw-island.mjs) so the console's element resets do
 * not strip them. `dark` switches the app's own dark variants.
 */
export function Island({ children, cls, inline }: { children: ReactNode; cls?: string; inline?: boolean }) {
  const { theme } = useConsole();
  const className = 'cx-tw' + (theme === 'dark' ? ' dark' : '') + (cls ? ' ' + cls : '');
  return inline ? <span className={className}>{children}</span> : <div className={className}>{children}</div>;
}

/** The live project settings menu (Edit, leads, manager, client, delete) — same component, same rules. */
export function ProjectMenu({ eng, onDeleted }: { eng: Engagement; onDeleted?: () => void }) {
  // The live menu renders nothing for a project lead (canEdit = admin or manager).
  if (useConsole().seat === 'lead') return null;
  return (
    <Island inline cls="cx-menu">
      <ProjectActionsMenu engagement={eng} className="ib cx-kebab" onDeleted={onDeleted} />
    </Island>
  );
}

/* ---------------------------------------------------------------- marks */

export function HolderPill({ h, sm }: { h: Holder; sm?: boolean }) {
  const ico = h.who === 'client' ? 'mail' : h.who === 'you' ? 'check' : h.who === 'mca' ? 'globe' : h.who === 'lead' ? 'team' : h.who === 'manager' ? 'clock' : 'check';
  const title =
    h.who === 'none'
      ? h.long
      : `Who holds the current step: ${
          h.who === 'you'
            ? h.long === 'Needs you'
              ? 'you (it needs your decision)'
              : 'you'
            : h.who === 'manager'
              ? 'your manager (it waits on their decision)'
              : h.who === 'client'
                ? 'the client'
                : h.who === 'mca'
                  ? 'the Ministry of Corporate Affairs'
                  : h.long.replace(/^With /, '')
        }${h.since ? `, since ${dShort(h.since)}` : ''}`;
  return (
    <span className={'pill ' + holderPillKind(h.who) + (sm ? ' sm' : '')} title={title}>
      <Icon name={ico} />
      {holderText(h)}
    </span>
  );
}

export function HealthMark({ h }: { h: Health }) {
  return (
    <span className="mx-hh" title={`Health: ${h.label} · ${h.why}`}>
      <i style={{ background: h.color }} />
      {h.label}
    </span>
  );
}

/** The four health colours and what they mean (legend on panels that show health). */
export const HEALTH_LEGEND: Array<{ label: string; color: string; why: string }> = [
  { label: 'On track', color: HEALTH_COLOR.ok, why: 'nothing is late' },
  { label: 'At risk', color: HEALTH_COLOR.risk, why: 'the current step is due within 3 days, or the project is marked for review' },
  { label: 'Stuck', color: HEALTH_COLOR.stuck, why: 'a step is past its window, or the project is marked past due' },
  { label: 'New', color: HEALTH_COLOR.new, why: 'no step done yet' },
];

/* ---------------------------------------------------------------- date window (manager) */

/**
 * Set or clear one date window (prototype "Window 13 to 20 Oct · Edit"; live
 * ScheduleWindowControl): same API (`setEngagementWindowInDb`), same rule
 * (manager, admin, super admin — the repository enforces it).
 */
export function WindowEditor({
  eng,
  target,
  label,
  value,
}: {
  eng: Engagement;
  target: { kind: 'incorporation' } | { kind: 'step'; itemId: string };
  label: string;
  value?: { from: string; to: string } | null;
}) {
  const { closePop, toast } = useConsole();
  const qc = useQueryClient();
  const [from, setFrom] = useState(value?.from ?? '');
  const [to, setTo] = useState(value?.to ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const valid = isValidWindowRange(from, to);
  const commit = async (next: { from: string; to: string } | null) => {
    setBusy(true);
    setErr('');
    try {
      await setEngagementWindowInDb(eng.id, target, next);
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      closePop();
      toast(next ? `${label} window saved · ${formatWindow(next)}` : `${label} window cleared`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the window. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cx-win">
      <PopHead title={`${label} window`} sub={value ? `Now ${formatWindow(value)}` : 'No window set yet'} />
      <div className="mx-form2">
        <label className="mx-f">
          <span className="mx-fl">From</span>
          <input className="mx-in" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">To</span>
          <input className="mx-in" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {from && to && !valid ? <p className="cx-err">The end date must not be before the start.</p> : null}
      {err ? <p className="cx-err">{err}</p> : null}
      <div className="pop-foot">
        {value ? (
          <Btn cls="sm" ico="x" disabled={busy} onClick={() => void commit(null)}>
            Clear
          </Btn>
        ) : null}
        <span className="sp" />
        <Btn cls="sm" onClick={closePop} disabled={busy}>
          Cancel
        </Btn>
        <Btn cls="sm pri" ico="check" disabled={busy || !valid} onClick={() => void commit({ from, to })}>
          {busy ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- "What's this?" */

/**
 * The prototype's "What's this?" drawer, from real text only: the catalog's
 * description, what the step needs, its forms and timeline, and a follow-up
 * question that goes to Ask VCFO with the step named.
 */
export function StepWhatDrawer({ item, eng }: { item: ChecklistItem; eng: Engagement }) {
  const { closeDrawer, openChat } = useConsole();
  const [q, setQ] = useState('');
  const needs = stepNeeds(item);
  const timeline = stepTimeline(item);
  const phase = phaseNoOf(item.id);
  const ask = (text: string) => {
    closeDrawer();
    openChat(text);
  };
  return (
    <div className="mx-whatd">
      <DrawerHead
        eyebrow={`${stepCode(item.id)} · ${eng.companyName}`}
        title={item.title}
        chips={
          <>
            {phase ? <span className="pill mut">{`Phase ${phase} · ${PHASE_SHORT[phase - 1]}`}</span> : null}
            <span className="pill mut">{item.responsibleRole === 'client' ? 'The client fills it' : 'SBC runs it'}</span>
          </>
        }
      />
      <div className="mx-digest">
        <p>{stepDescription(item) || 'No description is written for this step yet.'}</p>
      </div>
      {needs.length ? (
        <section className="mx-ds2">
          <span className="eyebrow">What it needs</span>
          <ul className="cx-ul">
            {needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {item.forms.length || timeline ? (
        <section className="mx-ds2">
          <span className="eyebrow">Forms and time</span>
          <div className="mx-facts">
            <div>
              <span>Forms</span>
              <b>{item.forms.length ? item.forms.join(', ') : 'None'}</b>
            </div>
            <div>
              <span>Usually takes</span>
              <b>{timeline || '—'}</b>
            </div>
          </div>
        </section>
      ) : null}
      <section className="mx-ds2">
        <span className="eyebrow">Ask VCFO</span>
        <div className="mx-addrow">
          <input
            className="mx-in"
            value={q}
            placeholder="Ask a follow-up about this step"
            aria-label="Ask a follow-up about this step"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim()) ask(`${eng.companyName} · ${item.title}: ${q.trim()}`);
            }}
          />
          <Btn cls="sm pri" ico="chat" disabled={!q.trim()} onClick={() => ask(`${eng.companyName} · ${item.title}: ${q.trim()}`)}>
            Ask
          </Btn>
        </div>
        <button type="button" className="link" onClick={() => ask(`What is ${item.title} and what should I check before it moves on?`)}>
          What should I check on this step?
        </button>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- status brief */

export function briefText(v: ClientView, me?: string | null): string {
  const e = v.e;
  const lines: string[] = [];
  lines.push(`${e.companyName} · status as of ${dShort(todayIso())}`);
  lines.push('');
  lines.push(`Stage: ${v.stage === 'inc' ? 'Incorporating' : 'Compliance'} · day ${v.day}${v.leads.length ? ` · project lead ${v.leads.map((l) => l.name).join(', ')}` : ''}`);
  if (v.current) lines.push(`Now: ${stepCode(v.current.id)} ${v.current.title} · ${holderText(v.holder)}`);
  else lines.push(`Now: ${v.holder.long}`);
  lines.push(`Progress: ${v.model.all.done} of ${v.model.all.total} steps · ${v.model.phases.map((p, i) => `${PHASE_SHORT[i]} ${p.done}/${p.total}`).join(' · ')}`);
  lines.push(`Health: ${v.health.label} · ${v.health.why}`);
  if (v.current?.due) lines.push(`Current step due: ${dShort(v.current.due)}`);
  if (v.model.coiExpected) lines.push(`Incorporation window ends: ${dShort(v.model.coiExpected)}`);
  if (v.approvals.length) lines.push(`Waiting on the manager: ${plural(v.approvals.length, 'decision')}`);
  const late = v.model.steps.filter((s) => s.late);
  if (late.length) {
    lines.push('');
    lines.push('Late steps:');
    for (const s of late) lines.push(`• ${stepCode(s.id)} ${s.title} · ${s.lateDays} day${s.lateDays === 1 ? '' : 's'} late`);
  }
  if (me) {
    lines.push('');
    lines.push(`Prepared by ${me} · SBC`);
  }
  return lines.join('\n');
}

export function StatusBrief({ v }: { v: ClientView }) {
  const { me, toast } = useConsole();
  const text = briefText(v, me?.name);
  const ref = useRef<HTMLPreElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Status brief copied');
    } catch {
      toast('Copying is blocked here · select the text and copy it');
    }
  };
  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(v.e.slug || 'client').toLowerCase()}-status-brief.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <ModalBody
      title="Status brief"
      sub="Plain text you can paste into an email or a message. Built from the project as it stands now."
      foot={
        <>
          <Btn ico="dl" onClick={download}>
            Download .txt
          </Btn>
          <span className="sp" />
          <Btn cls="pri" ico="copy" onClick={() => void copy()}>
            Copy
          </Btn>
        </>
      }
    >
      <pre ref={ref} className="mx-pre cx-pre">
        {text}
      </pre>
    </ModalBody>
  );
}

/* ---------------------------------------------------------------- states */

export function Loading({ label }: { label: string }) {
  return (
    <div className="glass panel mx-p">
      <div className="sec-load">{label}</div>
    </div>
  );
}

export function NotFound({ settled, what = 'This client' }: { settled: boolean; what?: string }) {
  const { go } = useConsole();
  const paths = useClientPaths();
  if (!settled) return <Loading label="Loading the client…" />;
  return (
    <section className="glass panel mx-p">
      <div className="mx-empty cx-nf">
        <Icon name="alert" />
        <b>{what} is not in your book</b>
        <span>It may have been removed, or the link is out of date.</span>
      </div>
      <div className="cx-center">
        <Btn cls="sm" ico="back" onClick={() => go(paths.list)}>
          Back to clients
        </Btn>
      </div>
    </section>
  );
}
