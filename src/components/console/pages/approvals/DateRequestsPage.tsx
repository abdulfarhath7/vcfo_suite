'use client';

/**
 * DATE REQUESTS — /app/manager/date-requests (prototype mxRenderers.requests,
 * mxDecide; a59q_mgr_pages.js).
 *
 * The live tool decides date requests where they appear: a client's
 * "Request a timeline change" (client portal › Master calendar) shows on the
 * project page (TimelineRequestsPanel) with Approve and update the timeline /
 * Decline and an optional note. That is the one real kind — the prototype's
 * lead → manager date-change request has no table, route or screen in the live
 * tool. This page lists every client's pending request across the book with
 * the same decision (same route, same note), plus the closed ones.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { canSetScheduleWindows } from '@/lib/schedule-windows';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Btn, ClientAv, Icon, Seg, hueOf } from '../../ui';
import { companyInitials } from '../clients/model';
import { dShort, Loading, stamp } from '../clients/shared';
import { DR_RESULT_LABEL, daysBetween, plural, slipText, type DrDecided, type DrPhase, type DrWaiting } from './model';
import { CLOSED_KEY, decideTimeline, useDateRequests, useDateRequestsBadge } from './data';
import { clientHref, EdgeLegend, ErrorPanel, NoteModal, ScopeHint } from './bits';

type Tab = 'open' | 'done';

export function DateRequestsPage() {
  useCrumbs(['Date requests']);
  useDateRequestsBadge();
  const { model, timeline, closed, today } = useDateRequests();
  const { engagementsSettled } = useApp();
  const { base, go } = useConsole();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('open');

  // A request decided elsewhere (the client overview) leaves the pending list: refresh the closed list too.
  const pendingKey = model.waiting.map((w) => w.id).join(',');
  const prev = useRef(pendingKey);
  useEffect(() => {
    if (prev.current !== pendingKey) void qc.invalidateQueries({ queryKey: CLOSED_KEY });
    prev.current = pendingKey;
  }, [pendingKey, qc]);

  const palette = useMemo<PaletteItem[]>(
    () =>
      model.waiting.map((w) => ({
        id: `date-request:${w.id}`,
        label: `Timeline change · ${w.e.companyName}`,
        kind: 'Date request',
        sw: hueOf(w.e.id),
        go: () => go(`${base}/date-requests`),
      })),
    [model.waiting, go, base],
  );
  useConsolePalette('mgr-date-requests', palette);

  const loading = !engagementsSettled || (tab === 'open' ? timeline.loading : closed.isPending);
  const error = tab === 'open' ? timeline.error : closed.isError;
  const list = tab === 'open' ? model.waiting : model.decided;
  const hidden = tab === 'open' ? model.all.waiting - model.waiting.length : model.all.decided - model.decided.length;

  return (
    <>
      <div className="sec-h">
        <h2>Date requests</h2>
        <span className="sec-count">{timeline.loading && !engagementsSettled ? 'Loading…' : `${model.waiting.length} waiting`}</span>
        <span className="sp" />
        <Seg<Tab>
          ariaLabel="Waiting or decided"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: 'Waiting', n: model.waiting.length },
            { value: 'done', label: 'Decided', n: model.decided.length },
          ]}
        />
      </div>
      <p className="mx-lede">
        {tab === 'open'
          ? 'Only you set a project’s dates. When a client needs the incorporation plan to move, they ask with a reason; approving writes their dates into the schedule, declining keeps it as it is.'
          : 'Requests approved, declined or withdrawn in the last 30 days.'}
      </p>
      <ScopeHint hidden={hidden} what="request" />

      {error && !list.length ? (
        <ErrorPanel what={tab === 'open' ? 'Could not load the date requests' : 'Could not load the decided requests'} retry={() => (tab === 'open' ? timeline.retry() : void closed.refetch())} />
      ) : loading && !list.length ? (
        <Loading label="Loading the date requests…" />
      ) : !list.length ? (
        <section className="glass panel mx-p">
          <div className="mx-empty">
            <Icon name="check" />
            <b>{tab === 'open' ? 'No date requests are waiting' : 'Nothing decided in the last 30 days'}</b>
            <span>{tab === 'open' ? 'When a client asks to move their incorporation timeline, the request appears here.' : 'Requests you approve or decline appear here.'}</span>
          </div>
        </section>
      ) : (
        <>
          {tab === 'open' ? model.waiting.map((w) => <WaitingRequest key={w.id} w={w} today={today} />) : model.decided.map((d) => <DecidedRequest key={d.id} d={d} />)}
          <EdgeLegend
            items={
              tab === 'open'
                ? [['var(--due)', 'Waiting for you']]
                : [
                    ['var(--mx-ok)', 'Approved'],
                    ['var(--over)', 'Declined'],
                    ['var(--line)', 'Withdrawn by the client or replaced by a newer request'],
                  ]
            }
          />
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- the dates */

function range(p: { from?: string; to?: string; milestone: boolean }): string {
  if (!p.from) return '—';
  return p.milestone || p.from === p.to ? dShort(p.from) : `${dShort(p.from)} – ${dShort(p.to)}`;
}

function Phases({ phases, compare }: { phases: DrPhase[]; compare: boolean }) {
  if (!phases.length) return null;
  return (
    <div className="ap-phs" role="table" aria-label="Phases asked for">
      <div className="ap-ph head" role="row">
        <span role="columnheader">Phase</span>
        {compare ? <span role="columnheader">Now</span> : null}
        <span role="columnheader">Asked for</span>
        {compare ? <span role="columnheader">Moves</span> : null}
      </div>
      {phases.map((p) => (
        <div key={p.id} className={'ap-ph' + (compare ? '' : ' two')} role="row">
          <span role="cell" className="ap-ell" title={p.name}>
            {p.name}
          </span>
          {compare ? <span role="cell">{range({ from: p.nowFrom, to: p.nowTo, milestone: p.milestone })}</span> : null}
          <span role="cell">
            <b>{range({ from: p.askFrom, to: p.askTo, milestone: p.milestone })}</b>
          </span>
          {compare ? (
            <span role="cell" className={'ap-num' + (p.shift && p.shift > 0 ? ' late' : '')} title={p.milestone ? 'Days the COI day moves' : 'Days the end of the phase moves'}>
              {p.shift === undefined ? '—' : p.shift === 0 ? '0' : `${p.shift > 0 ? '+' : ''}${p.shift}d`}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CoiBlock({ now, ask, slip, today, reason }: { now?: string; ask?: string; slip: number; today?: string; reason: string }) {
  return (
    <div className="mx-rqd">
      <div className="mx-rqdate">
        <span className="eyebrow">COI now</span>
        <b>{now ? dShort(now) : '—'}</b>
        <span className="small">{now && today ? (daysBetween(today, now) >= 0 ? `in ${plural(daysBetween(today, now), 'day')}` : `${plural(-daysBetween(today, now), 'day')} ago`) : 'expected incorporation'}</span>
      </div>
      <span className="mx-rqarrow">
        <Icon name="ne" />
      </span>
      <div className="mx-rqdate to">
        <span className="eyebrow">Asked for</span>
        <b>{ask ? dShort(ask) : '—'}</b>
        <span className="small">{slipText(slip)}</span>
      </div>
      <div className="mx-rqwhy">
        <span className="eyebrow">Reason</span>
        <p>{reason}</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- a waiting request */

function WaitingRequest({ w, today }: { w: DrWaiting; today: string }) {
  const { base, go, openModal } = useConsole();
  const { user } = useApp();
  const qc = useQueryClient();
  const canDecide = canSetScheduleWindows(user?.role);
  const email = w.e.clientEmail?.trim();
  const decide = (approve: boolean) =>
    openModal(
      <NoteModal
        title={approve ? 'Approve and update the timeline' : 'Decline the request'}
        sub={`${w.e.companyName} · asked by ${w.who} (client) on ${dShort(w.sent)}`}
        banner={
          approve ? (
            <div className="banner info">
              <Icon name="clock" />
              <div>
                <b>{w.coiAsk ? `The certificate date moves to ${dShort(w.coiAsk)} (${slipText(w.slip)})` : 'The schedule takes the client’s dates'}</b>
                Every phase window is set to the dates asked for, and the incorporation window runs from the start of Phase 1 to the certificate. The lead’s task for this request closes.
              </div>
            </div>
          ) : null
        }
        label="Note to the client (optional)"
        confirm={approve ? 'Approve and update the timeline' : 'Decline'}
        run={async (note) => {
          await decideTimeline(qc, w.e.id, w.id, approve ? 'approve' : 'reject', note);
          return approve ? `Timeline updated · ${w.e.companyName}` : `Request declined · ${w.e.companyName}`;
        }}
      />,
    );
  const mail = () => {
    const q = new URLSearchParams();
    if (email) q.set('to', email);
    q.set('subject', `Your timeline change request · ${w.e.companyName}`);
    q.set('body', `Hello,\n\nAbout your request to move the incorporation timeline (“${w.req.reason}”):\n\n\n\nRegards`);
    go(`${base}/mail?${q.toString()}`);
  };
  return (
    <section className="glass panel mx-rq">
      <div className="mx-aph">
        <ClientAv id={w.e.id} label={companyInitials(w.e.companyName)} />
        <div className="mx-dt">
          <b className="ap-ell" title={`${w.who} asks to move the incorporation timeline`}>{`${w.who} asks to move the incorporation timeline`}</b>
          <span className="ap-ell">{`${w.e.companyName} · client · sent ${stamp(w.req.createdAt)}`}</span>
        </div>
        <span className="pill due" title={`Waiting on your decision for ${plural(Math.max(0, daysBetween(w.sent, today)), 'day')}`}>
          Waiting for you
        </span>
      </div>
      <CoiBlock now={w.coiNow} ask={w.coiAsk} slip={w.slip} today={today} reason={w.req.reason} />
      <Phases phases={w.phases} compare />
      <div className="mx-apa">
        <Btn cls="sm" ico="grid" onClick={() => go(`${clientHref(base, w.e)}#cx-timeline`)}>
          Open the client
        </Btn>
        {email ? (
          <Btn cls="sm" ico="mail" onClick={mail}>
            Email the client
          </Btn>
        ) : null}
        <span className="sp" />
        {canDecide ? (
          <>
            <Btn cls="sm" ico="x" onClick={() => decide(false)}>
              Decline
            </Btn>
            <Btn cls="sm pri" ico="check" onClick={() => decide(true)}>
              Approve
            </Btn>
          </>
        ) : (
          <span className="small">Waiting for the project manager to decide</span>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- a closed request */

function DecidedRequest({ d }: { d: DrDecided }) {
  const { base, go } = useConsole();
  const cls = d.result === 'ok' ? 'ok' : d.result === 'no' ? 'no' : 'ap-wd';
  const pill = d.result === 'ok' ? 'ok' : d.result === 'no' ? 'over' : 'mut';
  const when = d.result === 'wd' ? `closed ${stamp(d.at)}` : `decided ${stamp(d.at)}${d.by ? ` by ${d.by}` : ''}`;
  return (
    <section className={'glass panel mx-rq ' + cls}>
      <div className="mx-aph">
        <ClientAv id={d.e.id} label={companyInitials(d.e.companyName)} />
        <div className="mx-dt">
          <b className="ap-ell">{`${d.who} asked to move the incorporation timeline`}</b>
          <span className="ap-ell">{`${d.e.companyName} · sent ${dShort(d.sent)} · ${when}`}</span>
        </div>
        <span className={'pill ' + pill}>{DR_RESULT_LABEL[d.result]}</span>
      </div>
      <CoiBlock now={d.coiNow} ask={d.coiAsk} slip={d.slip} reason={d.req.reason} />
      <Phases phases={d.phases} compare={false} />
      {d.note ? (
        <div className={'banner ' + (d.result === 'ok' ? 'ok' : 'over')}>
          <Icon name="notes" />
          <div>
            <b>{d.by === 'You' ? 'Your note' : 'Note'}</b>
            {d.note}
          </div>
        </div>
      ) : null}
      <div className="mx-apa">
        <Btn cls="sm" ico="grid" onClick={() => go(`${clientHref(base, d.e)}#cx-timeline`)}>
          Open the client
        </Btn>
      </div>
    </section>
  );
}
