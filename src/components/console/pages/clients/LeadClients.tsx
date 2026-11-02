'use client';

/**
 * CLIENTS for a project lead — /app/intern/clients. The live lead list
 * (src/views/intern/Clients.tsx) kept function for function: the engagements
 * assigned to the lead (`useInternPortfolio().myEngagements`, Operational
 * Readiness included — the live lead list does not drop it), "N active
 * engagements", each company with its stage and the live set-up progress %
 * (`engagementSetupProgressPercent`), one click to the client, and the same
 * empty state. Drawn as the prototype's lead cards (a59_lead.js `.lc`) with
 * what real data gives: health (with a filter), overdue steps, steps waiting
 * on the client, steps with the manager, the next filing or step, and the
 * project manager (the lead's directory, as the live "My managers" card reads it).
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Icon, Seg, hueOf } from '../../ui';
import { buildClientView, companyInitials, plural, stepCode, type ClientView, type HealthKey } from './model';
import { dShort, HEALTH_LEGEND, useClientPaths, usePeople, useToday } from './shared';
import { NocStrip } from './noc';
import { useToday as useTodayModel } from '../today/useToday';

type HealthFilter = 'all' | HealthKey;

const HEALTH_PILL: Record<HealthKey, string> = { stuck: 'over', risk: 'due', ok: 'done', new: 'mut' };

export function LeadClients() {
  useCrumbs(['Clients']);
  const paths = useClientPaths();
  const { go, scope } = useConsole();
  const { getStateForEngagement, engagementsSettled } = useApp();
  const { myEngagements, progressByEngagement, filings } = useInternPortfolio();
  const today = useToday();
  const people = usePeople();
  const [filter, setFilter] = useState<HealthFilter>('all');

  const directory = useQuery({
    queryKey: ['outlook-directory', 'intern-managers'],
    queryFn: async () => {
      const res = await fetch('/api/outlook/directory');
      const json = (await res.json().catch(() => ({}))) as { people?: DirectoryPerson[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'directory_failed');
      return json.people ?? [];
    },
    staleTime: 5 * 60_000,
  });

  // One health rule everywhere (README): Stuck if a step is late OR a filing is overdue. The register's overdue
  // filings come from the shared Today model, the same rows the Filings register and the lead's Today read.
  const { model: tm } = useTodayModel();
  const views = useMemo(
    () =>
      myEngagements.map((e) => buildClientView(e, getStateForEngagement(e), people, today, 'lead', tm.byId[e.id]?.overdue ?? 0)),
    [myEngagements, getStateForEngagement, people, today, tm],
  );
  const inScope = views.filter((v) => scope === 'all' || v.stage === scope);
  const shown = inScope.filter((v) => filter === 'all' || v.health.key === filter);
  const count = (k: HealthKey) => inScope.filter((v) => v.health.key === k).length;

  const palette = useMemo<PaletteItem[]>(
    () => myEngagements.map((e) => ({ id: `client:${e.id}`, label: e.companyName, kind: 'Client', sw: hueOf(e.id), go: () => go(paths.project(e)) })),
    [myEngagements, go, paths],
  );
  useConsolePalette('clients-page', palette);

  const loading = !engagementsSettled && !myEngagements.length;
  const atRisk = views.filter((v) => v.health.key === 'stuck' || v.health.key === 'risk').length;

  return (
    <>
      <div className="sec-h">
        <h2>Clients</h2>
        <span className="sec-count">{loading ? 'Loading…' : plural(myEngagements.length, 'active engagement')}</span>
        {atRisk ? <span className="small">{`${atRisk} at risk or stuck`}</span> : null}
        <span className="sp" />
        <Seg<HealthFilter>
          ariaLabel="Show clients by health"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', n: inScope.length },
            { value: 'stuck', label: 'Stuck', n: count('stuck') },
            { value: 'risk', label: 'At risk', n: count('risk') },
            { value: 'ok', label: 'On track', n: count('ok') },
            { value: 'new', label: 'New', n: count('new') },
          ]}
        />
      </div>

      <NocStrip engagements={myEngagements} />

      {loading ? (
        <section className="glass panel mx-p">
          <div className="sec-load">Loading your clients…</div>
        </section>
      ) : !myEngagements.length ? (
        <section className="glass panel mx-p">
          <div className="mx-empty">
            <Icon name="grid" />
            <b>No engagements assigned yet</b>
            <span>Clients your manager assigns to you appear here.</span>
          </div>
        </section>
      ) : !shown.length ? (
        <section className="glass panel mx-p">
          <div className="mx-empty">
            <Icon name="grid" />
            <b>No client matches</b>
            <span>Switch the health filter or the stage to All to see every client.</span>
          </div>
        </section>
      ) : (
        <div className="lclients">
          {shown.map((v) => (
            <LeadCard
              key={v.e.id}
              v={v}
              pct={progressByEngagement.get(v.e.id) ?? 0}
              nextFiling={filings.filter((f) => f.engagementId === v.e.id && f.status !== 'filed').sort((a, b) => a.nextDue.localeCompare(b.nextDue))[0]}
              manager={directory.data?.find((p) => p.userId === v.e.managerId)?.name}
              overdueFilings={tm.byId[v.e.id]?.overdue ?? 0}
            />
          ))}
        </div>
      )}

      {!loading && myEngagements.length ? (
        <div className="cx-foot">
          <div className="mx-leg cx-leg" aria-label="Health">
            {HEALTH_LEGEND.map((h) => (
              <span key={h.label} className="cx-lk" title={`${h.label}: ${h.why}`}>
                <i className="cx-dot" style={{ background: h.color }} />
                {h.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function LeadCard({ v, pct, nextFiling, manager, overdueFilings }: { v: ClientView; pct: number; nextFiling?: { filing: string; nextDue: string }; manager?: string; overdueFilings: number }) {
  const paths = useClientPaths();
  const { go } = useConsole();
  const e: Engagement = v.e;
  const lateSteps = v.model.counts.late;
  const late = lateSteps + overdueFilings;
  const waiting = v.model.counts.you;
  const withManager = v.approvals.length;
  const next = nextFiling
    ? `Next: ${nextFiling.filing} · ${dShort(nextFiling.nextDue)}`
    : v.current
      ? `Next: ${stepCode(v.current.id)} ${v.current.title}${v.current.due ? ` · ${dShort(v.current.due)}` : ''}`
      : 'Nothing due';
  return (
    <button type="button" className="glass lc cx-lc" style={{ ['--cc' as string]: hueOf(e.id) }} onClick={() => go(paths.project(e))} aria-label={`Open ${e.companyName}`}>
      <div className="lc-h">
        <span className="mono-ic">{companyInitials(e.companyName)}</span>
        <div className="cx-lch">
          <b className="cx-ell" title={e.companyName}>
            {e.companyName}
          </b>
          <span className="cx-ell">{[e.clientDisplayName, e.clientEmail].filter(Boolean).join(' · ') || 'No client sign-in yet'}</span>
        </div>
        <span className={'pill ' + HEALTH_PILL[v.health.key]} title={`Health: ${v.health.label} · ${v.health.why}`}>
          {v.health.label}
        </span>
      </div>
      <div className="lc-row" title="Set-up progress (the live progress ring)">
        <span>{stageDisplayLabel(e.stage)}</span>
        <b className="cx-num">{pct}%</b>
      </div>
      <div className="lc-pb" role="img" aria-label={`Set-up ${pct}% done`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="lc-stats">
        <div className={late ? 'r' : ''} title={`Overdue: steps past their window (${lateSteps}) + filings past their due date (${overdueFilings})`}>
          <b>{late}</b>
          <span>overdue</span>
        </div>
        <div className={waiting ? 'a' : ''} title="Steps that are the client's move">
          <b>{waiting}</b>
          <span>waiting on client</span>
        </div>
        <div title="Steps you sent to your manager, waiting on their decision">
          <b>{withManager}</b>
          <span>with the manager</span>
        </div>
      </div>
      <div className="lc-foot">
        <span className="small cx-ell" title={next}>
          {next}
        </span>
        <span className="sp" />
        <span className="small cx-ell" title={manager ? `Project manager: ${manager}` : 'Project manager'}>
          {manager ?? '—'}
        </span>
      </div>
    </button>
  );
}
