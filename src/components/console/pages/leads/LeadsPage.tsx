'use client';

/**
 * PROJECT LEADS — /app/manager/leads?lead=<intern key> (prototype
 * mxRenderers.leads): one lead at a time. Left, the profile: the lead
 * switcher, who they are, their numbers (open, overdue, clients, on time),
 * tasks by status (donut → breakdown), work by area of law, their clients,
 * and the live Team / People functions (add a lead, assign a project, change
 * the sign-in email, delete). Right, the lead's planner — the same work queue
 * the lead sees on their own Tasks page, with your dates locked.
 *
 * Leads = the book's leads plus your roster (a new lead has no client yet).
 * The pick is the `lead` query param (the sidebar links to it), else the one
 * remembered this session, else the first.
 */
import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { internAssignedToEngagement } from '@/lib/intern/intern-work';
import { windowForStep } from '@/lib/projects/schedule-windows';
import { checklist } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Drill, Menu, type MenuItem } from '../../overlays';
import { Btn, Donut, Empty, Icon, Legend, hueOf } from '../../ui';
import { stageOf } from '../clients/model';
import { istDay, personInitials } from '../today/model';
import { Planner } from '../work/planner/Planner';
import { TaskDrawer, firstOf } from '../work/planner/overlays';
import { projectHref, shortName } from '../work/planner/bits';
import { useLeadRows, usePlan, type LeadRow, type PlannerWho } from '../work/planner/data';
import { areaBars, onTimeRate, T_COLOR, T_LABEL, type PlanItem } from '../work/planner/model';
import { AREA_LABEL } from '@/lib/client-portal/compliances';
import { AddLeadModal, AssignProjectModal, ChangeEmailModal, DeleteLeadModal } from './people';
import { useLeadsBadge } from './badges';
import '../../css/96-work.css';
import '../../css/96-leads.css';

const PICK_KEY = 'vcfo-console-lead';

/** Steps done on or before their manager window, for one lead. */
export function onTimeFor(engagements: Engagement[], getState: (e: Engagement) => Record<string, { completedOn?: string } | undefined>, key: string) {
    const pairs: Array<{ doneOn: string; due: string }> = [];
    for (const e of engagements) {
      if (!internAssignedToEngagement(e, key)) continue;
      const st = getState(e);
      for (const it of checklist) {
        const w = windowForStep(e.schedule, it.id);
        const done = istDay(st[it.id]?.completedOn);
        if (w && done) pairs.push({ doneOn: done, due: w.to });
      }
    }
    return onTimeRate(pairs);
}
function useOnTime(key: string) {
  const { engagements, getStateForEngagement } = useApp();
  return useMemo(() => onTimeFor(engagements, getStateForEngagement, key), [engagements, getStateForEngagement, key]);
}

const STL: Array<{ label: string; color: string; test: (i: PlanItem) => boolean }> = [
  { label: 'Done', color: T_COLOR.done, test: (i) => i.st === 'done' },
  { label: 'In progress', color: T_COLOR.run, test: (i) => i.st === 'run' || i.st === 'wait' },
  { label: 'Due this week', color: T_COLOR.due, test: (i) => i.st === 'due' },
  { label: 'Overdue', color: T_COLOR.over, test: (i) => i.st === 'over' },
  { label: 'Not started', color: T_COLOR.none, test: (i) => i.st === 'none' },
];

function Inner() {
  useCrumbs(['Project leads']);
  useLeadsBadge();
  const { leads, loading, error, retry } = useLeadRows();
  const params = useSearchParams();
  const router = useRouter();
  const { base, openModal, go } = useConsole();
  const asked = params?.get('lead') ?? '';
  const remembered = typeof window !== 'undefined' ? safeGet(PICK_KEY) : '';
  const lead = leads.find((l) => l.key === asked) ?? leads.find((l) => l.key === remembered) ?? leads[0];
  useEffect(() => {
    if (lead) safeSet(PICK_KEY, lead.key);
  }, [lead]);
  const pick = (k: string) => router.replace(`${base}/leads?lead=${encodeURIComponent(k)}`, { scroll: false });

  const palette = useMemo<PaletteItem[]>(
    () => leads.map((l) => ({ id: `lead:${l.key}`, label: l.name, kind: 'Project lead', sw: hueOf(l.key), go: () => go(`${base}/leads?lead=${encodeURIComponent(l.key)}`) })),
    [leads, go, base],
  );
  useConsolePalette('mgr-leads-page', palette);

  if (loading && !leads.length) {
    return (
      <section className="glass panel mx-p">
        <div className="sec-load">Loading your project leads…</div>
      </section>
    );
  }
  if (error && !leads.length) {
    return (
      <section className="glass panel mx-p">
        <div className="mx-empty">
          <Icon name="alert" />
          <b>Your project leads could not load</b>
          <span>Check the connection and try again.</span>
        </div>
        <div className="lp-center">
          <Btn cls="sm" onClick={retry}>
            Try again
          </Btn>
        </div>
      </section>
    );
  }
  if (!lead) {
    return (
      <section className="glass panel mx-p">
        <div className="mx-empty">
          <Icon name="team" />
          <b>No project leads yet</b>
          <span>Add a lead, then assign them a project. They appear here with their workload.</span>
        </div>
        <div className="lp-center">
          <Btn cls="pri" ico="up" onClick={() => openModal(<AddLeadModal />, { label: 'Add project lead' })}>
            Add project lead
          </Btn>
        </div>
      </section>
    );
  }
  return <LeadView key={lead.key} lead={lead} leads={leads} pick={pick} />;
}

function LeadView({ lead, leads, pick }: { lead: LeadRow; leads: LeadRow[]; pick: (k: string) => void }) {
  const who: PlannerWho = useMemo(() => ({ mode: 'mgr-lead', key: lead.key, profileId: lead.profileId, name: lead.name, email: lead.email }), [lead]);
  const plan = usePlan(who);
  const { openPop, openModal, openDrawer, go, base } = useConsole();
  const { engagements, getStateForEngagement } = useApp();
  const onTime = useOnTime(lead.key);
  const all = plan.items;
  const open = all.filter((i) => i.st !== 'done');
  const over = open.filter((i) => i.st === 'over');
  const clients = engagements.filter((e) => internAssignedToEngagement(e, lead.key));
  const parts = STL.map((s) => ({ n: all.filter(s.test).length, color: s.color, label: s.label }));
  const leadName = (k?: string | null) => (k ? leads.find((l) => l.key === k)?.name ?? k : 'No lead');
  const rows = (list: PlanItem[]) =>
    list.map((i) => ({ id: i.id, title: `${i.title} · ${shortName(i.clientName)}`, meta: `${i.code} · ${i.dueLabel}`, state: T_LABEL[i.st], color: T_COLOR[i.st], onOpen: () => openDrawer(<TaskDrawer who={who} id={i.id} />) }));
  const drill = (i: number, el: Element | null) =>
    openPop(
      el,
      <Drill
        title={`${lead.name} · tasks`}
        sub={`${all.length} item${all.length === 1 ? '' : 's'} in the work queue`}
        active={i + 1}
        tabs={[{ label: 'All', rows: rows(all) }, ...STL.map((s) => ({ label: s.label, color: s.color, rows: rows(all.filter(s.test)) }))]}
      />,
      { cls: 'mx-wide' },
    );
  const bars = areaBars(all);
  const menu: Array<MenuItem | '-'> = [
    { label: 'Assign a project', sub: 'Make them the lead on a client', ico: 'grid', onSelect: () => openModal(<AssignProjectModal lead={lead} leadName={leadName} />, { label: 'Assign a project', cls: 'wide' }) },
  ];
  if (lead.roster && lead.profileId) {
    menu.push(
      { label: 'Change sign-in email', ico: 'mail', onSelect: () => openModal(<ChangeEmailModal lead={lead} />, { label: 'Change sign-in email' }) },
      '-',
      { label: 'Delete account', danger: true, ico: 'x', onSelect: () => openModal(<DeleteLeadModal lead={lead} onDone={() => go(`${base}/leads`)} />, { label: 'Delete account' }) },
    );
  }
  const more = (el: Element) => openPop(el, <Menu title={lead.name} items={menu} />, { cls: 'mx-narrow' });
  return (
    <div className="mx-lp">
      <aside className="glass mx-lprof" style={{ ['--lc' as string]: hueOf(lead.key) }}>
        <div className="mx-lpsw" role="group" aria-label="Project leads">
          {leads.map((x) => (
            <button key={x.key} type="button" className={'mx-lpb' + (x.key === lead.key ? ' on' : '')} style={{ ['--lc' as string]: hueOf(x.key) }} title={x.name} aria-pressed={x.key === lead.key} onClick={() => pick(x.key)}>
              <span>{personInitials(x.name)}</span>
            </button>
          ))}
          <button type="button" className="mx-lpb lp-add" title="Add project lead" aria-label="Add project lead" onClick={() => openModal(<AddLeadModal />, { label: 'Add project lead' })}>
            <Icon name="up" />
          </button>
        </div>
        <div className="mx-lpid">
          <span className="mx-lav big" style={{ ['--lc' as string]: hueOf(lead.key) }}>
            {personInitials(lead.name)}
          </span>
          <span className="eyebrow">Project lead</span>
          <h2 className="wk-ell" title={lead.name}>
            {lead.name}
          </h2>
          <span className="small wk-ell" title={lead.email}>
            {lead.email || (lead.roster ? 'No email on file' : 'Leads a client in your book; reports to another manager')}
          </span>
        </div>
        <div className="mx-lpst">
          <button type="button" className="lp-stat" title="Open items · open the list" onClick={(e) => drill(-1, e.currentTarget)}>
            <b>{open.length}</b>
            <span>Open</span>
          </button>
          <button type="button" className="lp-stat" title="Past their due date · open the list" onClick={(e) => drill(3, e.currentTarget)}>
            <b className={over.length ? 'red' : ''}>{over.length}</b>
            <span>Overdue</span>
          </button>
          <div title="Clients they lead">
            <b>{clients.length}</b>
            <span>Clients</span>
          </div>
          <div title={onTime.n ? `Steps done on or before your window, of ${onTime.n} with a window` : 'No finished step had a window you set yet'}>
            <b>{onTime.pct === null ? '—' : `${onTime.pct}%`}</b>
            <span>On time</span>
          </div>
        </div>
        <div className="mx-sub-h">
          <span className="eyebrow">Tasks by status</span>
        </div>
        <div className="mx-ts">
          <Donut parts={parts} size={104} onPick={(i, el) => drill(i, el)} center={[open.length, 'open']} />
          <Legend parts={parts} onPick={(i) => drill(i, null)} />
        </div>
        <div className="mx-sub-h">
          <span className="eyebrow">By area</span>
          <span className="small">done of total</span>
        </div>
        <div className="mx-areas">
          {bars.map((b) => (
            <div key={b.area} className="mx-area" title={`${AREA_LABEL[b.area]}: ${b.done} done, ${b.pending} pending, ${b.over} overdue, ${b.rest} not started`}>
              <span className="mx-arn">
                <b>{AREA_LABEL[b.area]}</b>
                <span>{`${b.done}/${b.total}`}</span>
              </span>
              <div className="mx-arb">
                {b.total ? (
                  <>
                    <i style={{ flex: b.done, background: 'var(--mx-ok)' }} />
                    <i style={{ flex: b.pending, background: 'var(--due)' }} />
                    <i style={{ flex: b.over, background: 'var(--over)' }} />
                    <i style={{ flex: b.rest, background: 'var(--mx-none)' }} />
                  </>
                ) : (
                  <i style={{ flex: 1, background: 'var(--line-2)' }} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="lp-leg" aria-label="Bar colours">
          <span><i style={{ background: 'var(--mx-ok)' }} />Done</span>
          <span><i style={{ background: 'var(--due)' }} />Pending</span>
          <span><i style={{ background: 'var(--over)' }} />Overdue</span>
          <span><i style={{ background: 'var(--mx-none)' }} />Not started</span>
        </div>
        <div className="mx-sub-h">
          <span className="eyebrow">Clients</span>
        </div>
        <div className="mx-lcl">
          {clients.length ? (
            clients.map((c) => (
              <button key={c.id} type="button" className="pill mut" title={c.companyName} onClick={() => go(projectHref(base, c))}>
                <span className="mx-dot" style={{ background: hueOf(c.id) }} />
                {shortName(c.companyName)}
                <i>{stageOf(c, getStateForEngagement(c)) === 'inc' ? 'Inc' : 'Cmp'}</i>
              </button>
            ))
          ) : (
            <span className="small">No clients yet. Use More › Assign a project.</span>
          )}
        </div>
        <div className="mx-lpa">
          <Btn cls="sm" ico="mail" disabled={!lead.email} onClick={() => go(`${base}/mail?to=${encodeURIComponent(lead.email)}`)}>
            {`Email ${firstOf(lead.name)}`}
          </Btn>
          <Btn cls="sm" ico="gantt" onClick={() => go(`${base}/team-load`)}>
            Compare the team
          </Btn>
          <button type="button" className="ib" aria-label={`More for ${lead.name}`} onClick={(e) => more(e.currentTarget)}>
            <Icon name="down" />
          </button>
        </div>
      </aside>
      <div className="mx-lpm">
        <div className="sec-h">
          <h2>{`${firstOf(lead.name)}'s planner`}</h2>
          <span className="sp" />
          <span className="small">Locked dates are yours; the lead plans inside them</span>
        </div>
        <Planner
          who={who}
          leads={leads}
          empty={<Empty title={`${firstOf(lead.name)} has no clients yet`} sub="Assign a project from More on the left; its steps and filings show here." />}
        />
      </div>
    </div>
  );
}

function safeGet(k: string): string {
  try {
    return sessionStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}
function safeSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}

export function LeadsPage() {
  return (
    <Suspense fallback={<div className="glass panel mx-p"><div className="sec-load">Loading your project leads…</div></div>}>
      <Inner />
    </Suspense>
  );
}
