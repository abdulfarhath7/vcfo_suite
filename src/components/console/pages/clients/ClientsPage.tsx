'use client';

/**
 * CLIENTS — /app/manager/projects (prototype mxClientsList, a59q_mgr_pages.js):
 * one card per client in the manager's book with the four-phase progress bar,
 * who holds the current step and for how long, the step itself, and health.
 *
 * Real data: the engagements the manager may see (`useApp().engagements`, the
 * repository scope) and their checklist (slim index), through the client
 * portal's step model. Live rules kept: the list leaves out Operational
 * Readiness projects, as the live Projects page does — they are named under
 * the grid so they stay one click away; the project settings menu is the live
 * one (same rules: managers ask an admin to delete, change the client or the
 * manager). The Stage filter is the console's own (top bar).
 */
import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Btn, ClientAv, Icon, Seg, StageTag, hueOf } from '../../ui';
import { buildClientView, companyInitials, isListedOnClients, PHASE_SHORT, plural, stageOf, stepCode, type ClientView } from './model';
import { dShort, HEALTH_LEGEND, HealthMark, HolderPill, ProjectMenu, usePeople, useToday, useClientPaths } from './shared';
import { NocStrip } from './noc';
import { LeadClients } from './LeadClients';
import { useToday as useTodayModel } from '../today/useToday';

/** The manager sees their book; a project lead sees the clients assigned to them (live lead list). */
export function ClientsPage() {
  const { seat } = useConsole();
  return seat === 'lead' ? <LeadClients /> : <ManagerClients />;
}

function ManagerClients() {
  const paths = useClientPaths();
  useCrumbs(['Clients']);
  const { engagements, engagementsSettled, getStateForEngagement } = useApp();
  const { go, scope, setScope } = useConsole();
  const today = useToday();
  const people = usePeople();

  const listed = useMemo(() => engagements.filter(isListedOnClients), [engagements]);
  const hidden = useMemo(() => engagements.filter((e) => !isListedOnClients(e)), [engagements]);
  // one health rule with Today: overdue register filings make a client Stuck too
  const { model: tm } = useTodayModel();
  const views = useMemo(
    () => listed.map((e) => buildClientView(e, getStateForEngagement(e), people, today, 'mgr', tm.byId[e.id]?.overdue ?? 0)),
    [listed, getStateForEngagement, people, today, tm],
  );
  const nInc = views.filter((v) => v.stage === 'inc').length;
  const shown = views.filter((v) => scope === 'all' || v.stage === scope);

  const palette = useMemo<PaletteItem[]>(
    () =>
      engagements.map((e) => ({
        id: `client:${e.id}`,
        label: e.companyName,
        kind: `Client · ${stageOf(e, getStateForEngagement(e)) === 'inc' ? 'Incorporating' : 'Compliance'}`,
        sw: hueOf(e.id),
        go: () => go(paths.project(e)),
      })),
    [engagements, getStateForEngagement, go],
  );
  useConsolePalette('clients-page', palette);

  const loading = !engagementsSettled && !engagements.length;
  const newProject = () => go(paths.newProject);

  return (
    <>
      <div className="sec-h">
        <h2>Clients</h2>
        <span className="sec-count">{loading ? 'Loading…' : plural(listed.length, 'active engagement')}</span>
        <span className="sp" />
        <Seg
          ariaLabel="Show clients by stage"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All', n: views.length },
            { value: 'inc', label: 'Incorporating', n: nInc },
            { value: 'cmp', label: 'Compliance', n: views.length - nInc },
          ]}
        />
        <Btn cls="pri" ico="build" onClick={newProject}>
          New project
        </Btn>
      </div>

      <NocStrip engagements={engagements} onNew={newProject} />

      {loading ? (
        <section className="glass panel mx-p">
          <div className="sec-load">Loading your clients…</div>
        </section>
      ) : !views.length ? (
        <section className="glass panel mx-p">
          <div className="mx-empty">
            <Icon name="grid" />
            <b>No clients in your book yet</b>
            <span>Projects you set up, and projects an admin assigns to you, appear here.</span>
          </div>
          <div className="cx-center">
            <Btn cls="pri" ico="build" onClick={newProject}>
              New project
            </Btn>
          </div>
        </section>
      ) : !shown.length ? (
        <section className="glass panel mx-p">
          <div className="mx-empty">
            <Icon name="grid" />
            <b>{scope === 'inc' ? 'No client is incorporating right now' : 'No client in the compliance stage is listed here'}</b>
            <span>Switch the stage to All to see every client.</span>
          </div>
        </section>
      ) : (
        <div className="mx-cgrid">
          {shown.map((v) => (
            <ClientCard key={v.e.id} v={v} />
          ))}
        </div>
      )}

      {!loading && views.length ? (
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
          <div className="mx-leg cx-leg" aria-label="Progress bar">
            <span className="cx-lk" title="Steps done in a phase">
              <i className="cx-sw" style={{ background: 'var(--mx-ok)' }} />
              Done
            </span>
            <span className="cx-lk" title="The phase the client is in">
              <i className="cx-sw cx-ring" />
              Current phase
            </span>
            <span className="cx-lk" title="A step of the phase is past its window">
              <i className="cx-sw" style={{ background: 'var(--over)' }} />
              Late
            </span>
          </div>
        </div>
      ) : null}

      {hidden.length ? <HiddenClients list={hidden} /> : null}
    </>
  );
}

function ClientCard({ v }: { v: ClientView }) {
  const paths = useClientPaths();
  const { go } = useConsole();
  const e = v.e;
  const open = () => go(paths.project(e));
  const late = new Set(v.model.steps.filter((s) => s.late).map((s) => s.phaseNo));
  const lead = v.leads[0]?.name;
  return (
    <div
      className="glass panel mx-cc"
      role="link"
      tabIndex={0}
      aria-label={`Open ${e.companyName}`}
      onClick={open}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' && ev.target === ev.currentTarget) open();
      }}
    >
      <div className="mx-cch">
        <ClientAv id={e.id} label={companyInitials(e.companyName)} big />
        <div className="mx-dt">
          <b className="cx-ell" title={e.companyName}>
            {e.companyName}
          </b>
          <span className="cx-ell" title={[e.clientDisplayName, e.clientEmail].filter(Boolean).join(' · ')}>
            {[e.clientDisplayName, e.clientEmail].filter(Boolean).join(' · ') || 'No client sign-in yet'}
          </span>
        </div>
        {v.approvals.length ? (
          <span className="pill due sm" title={`${plural(v.approvals.length, 'step')} wait for your decision`}>
            {`${v.approvals.length} need${v.approvals.length === 1 ? 's' : ''} you`}
          </span>
        ) : null}
        <StageTag need={v.stage} />
        <span onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()} role="presentation">
          <ProjectMenu eng={e} />
        </span>
      </div>
      <div className="mx-pbar2" role="group" aria-label="Progress by phase">
        {v.model.phases.map((p, i) => {
          const cur = p.state === 'active';
          const cls = p.state === 'done' ? 'done' : cur ? (late.has(i + 1) ? 'stuck' : 'cur') : '';
          const target = p.steps.find((s) => s.id === p.currentStepId) ?? p.steps.find((s) => s.kind !== 'done') ?? p.steps[0];
          return (
            <button
              key={p.id}
              type="button"
              style={{ flex: p.total }}
              className={cls}
              title={`${PHASE_SHORT[i]} · ${p.done} of ${p.total} done${target ? ` · click to open ${stepCode(target.id)} ${target.title}` : ''}`}
              aria-label={`${PHASE_SHORT[i]}: ${p.done} of ${p.total} done`}
              onClick={(ev) => {
                ev.stopPropagation();
                if (target) go(paths.step(e, target.id));
              }}
            >
              <i style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
            </button>
          );
        })}
      </div>
      <div className="mx-ccf">
        <HolderPill h={v.holder} />
        <span className="mx-dt">
          <b className="cx-ell" title={v.current ? `${stepCode(v.current.id)} ${v.current.title}` : undefined}>
            {v.current ? `${stepCode(v.current.id)} ${v.current.title}` : 'All steps done'}
          </b>
          <span className="cx-ell">{`${v.model.all.done} of ${v.model.all.total} steps · ${lead ? `lead ${lead}` : 'no lead yet'}`}</span>
        </span>
        <HealthMark h={v.health} />
      </div>
    </div>
  );
}

function HiddenClients({ list }: { list: Engagement[] }) {
  const paths = useClientPaths();
  const { go } = useConsole();
  return (
    <section className="glass panel mx-p cx-hidden">
      <div className="ph">
        <div className="mx-pt">
          <h3>{list.length === 1 ? '1 client in Operational Readiness' : `${list.length} clients in Operational Readiness`}</h3>
          <span className="small">Not on the list above, as on the live Projects page. Their filings are in the compliance calendar.</span>
        </div>
        <span className="sp" />
        <Btn cls="sm" ico="cal" onClick={() => go(paths.calendar)}>
          Open the calendar
        </Btn>
      </div>
      {list.map((e) => (
        <button key={e.id} type="button" className="mx-qi cx-qbtn" onClick={() => go(paths.project(e))}>
          <ClientAv id={e.id} label={companyInitials(e.companyName)} />
          <span className="mx-dt">
            <b className="cx-ell">{e.companyName}</b>
            <span>{e.incorporationDate ? `Incorporated ${dShort(e.incorporationDate)}` : 'Compliance stage'}</span>
          </span>
          <StageTag need={stageOf(e)} />
          <Icon name="chev" size={14} />
        </button>
      ))}
    </section>
  );
}
