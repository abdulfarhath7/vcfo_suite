'use client';

/**
 * APPROVALS — /app/manager/approvals (prototype mxRenderers.approvals,
 * mxApprove, mxSendBack, mxPreview; a59q_mgr_pages.js).
 *
 * Live (src/views/admin/ApprovalsInbox.tsx, scope 'manager'): the same rows
 * (`usePendingApprovals('manager')`) and "Your pending requests" to an admin
 * with Withdraw (ProjectChangeRequestsPanel). The live inbox only linked to the
 * step; here each card also decides in place with the step page's own calls
 * (see data.ts), so the client and the lead hear exactly what they hear today.
 * Live has no Undo on these decisions, so neither does this page.
 */
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { getItem } from '@/data/checklist';
import { isAdminOrManager } from '@/lib/auth';
import { decideChangeRequestInDb, listChangeRequestsFromDb } from '@/lib/project-admin-db';
import { CHANGE_REQUEST_KIND_LABEL, type ChangeRequestKind } from '@/lib/project-change-request-types';
import { stepDescription } from '@/components/portal/sections/incorporation/model';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, ClientAv, Icon, Seg, hueOf } from '../../ui';
import { companyInitials } from '../clients/model';
import { dShort, Island, Loading, stamp, useFullChecklist } from '../clients/shared';
import { useTodayIso } from '../today/useToday';
import { AP_ACTION, AP_KIND_LABEL, answerRows, clientFieldLabels, daysBetween, istDay, plural, type ApDecided, type ApWaiting } from './model';
import { decideApproval, useApprovals, useApprovalsBadge, useDecideDeps } from './data';
import { EdgeLegend, ErrorPanel, NoteModal, ScopeHint, stepHref } from './bits';

const BoardResolutionDocPreview = dynamic(() => import('@/components/board-resolution/BoardResolutionDocPreview').then((m) => m.BoardResolutionDocPreview), {
  ssr: false,
  loading: () => <div className="sec-load">Loading the document…</div>,
});

type Tab = 'open' | 'done';

export function ApprovalsPage() {
  useCrumbs(['Approvals']);
  useApprovalsBadge();
  const { model, book } = useApprovals();
  const { base, go } = useConsole();
  const [tab, setTab] = useState<Tab>('open');

  const palette = useMemo<PaletteItem[]>(
    () =>
      model.waiting.map((w) => ({
        id: `approval:${w.id}`,
        label: `${w.title} · ${w.e.companyName}`,
        kind: `Approval · ${AP_KIND_LABEL[w.kind]}`,
        sw: hueOf(w.e.id),
        go: () => go(stepHref(base, w.e, w.itemId)),
      })),
    [model.waiting, go, base],
  );
  useConsolePalette('mgr-approvals', palette);

  const list = tab === 'open' ? model.waiting : model.decided;
  const hidden = tab === 'open' ? model.all.waiting - model.waiting.length : model.all.decided - model.decided.length;

  return (
    <>
      <div className="sec-h">
        <h2>Approvals</h2>
        <span className="sec-count">{book.loading ? 'Loading…' : `${model.waiting.length} waiting for you`}</span>
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
          ? 'Steps that need your decision before the work goes on: board resolutions your leads send, steps a lead asks you to approve, submissions from the client, and steps a lead asks to send to the client. Approve, or send it back with a note.'
          : 'The latest decision on each step in the last 30 days, from what the step records.'}
      </p>
      <ScopeHint hidden={hidden} what={tab === 'open' ? 'approval' : 'decision'} />

      {book.error && !list.length ? (
        <ErrorPanel what="Could not load your clients’ steps" retry={book.retry} />
      ) : book.loading ? (
        <Loading label="Loading what waits for you…" />
      ) : !list.length ? (
        <section className="glass panel mx-p">
          {tab === 'open' ? (
            <div className="mx-empty">
              <Icon name="check" />
              <b>Nothing is waiting for your approval</b>
              <span>When a lead sends a step for approval or a client submits one, it appears here.</span>
              <Btn cls="sm" ico="grid" onClick={() => go(`${base}/projects`)}>
                View clients
              </Btn>
            </div>
          ) : (
            <div className="mx-empty">
              <Icon name="check" />
              <b>Nothing decided in the last 30 days</b>
              <span>Your approvals and send-backs appear here once you make them.</span>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="mx-aps">{tab === 'open' ? model.waiting.map((w) => <WaitingCard key={w.id} w={w} />) : model.decided.map((d) => <DecidedCard key={d.id} d={d} />)}</div>
          <EdgeLegend
            items={
              tab === 'open'
                ? [['var(--due)', 'Waiting for you']]
                : [
                    ['var(--mx-ok)', 'Approved, accepted or sent to the client'],
                    ['var(--over)', 'Sent back, rejected or declined'],
                  ]
            }
          />
        </>
      )}

      <ChangeRequests />
    </>
  );
}

/* ---------------------------------------------------------------- one waiting card */

function detailOf(w: ApWaiting): string {
  if (w.kind === 'board') return `${w.from.name} sent the draft board resolution. Approving releases it to the client to download, sign and upload; sending it back returns it to the lead with your note.`;
  if (w.kind === 'lead') return `${w.from.name} filled this step and asks for your approval. Approving marks it done and sends it to the client to approve.`;
  if (w.kind === 'client') return `${w.from.name} submitted this step for review. Accept it to mark it done, or reject it so they can fix it and submit again.`;
  return `${w.from.name} asks to send this step to the client to fill. Approving emails the client from your mailbox with a link to the step; declining tells only the lead.`;
}

function WaitingPill({ w }: { w: ApWaiting }) {
  const waited = w.since ? `Waiting on your decision since ${dShort(w.since)}${w.days !== undefined ? ` (${plural(w.days, 'day')})` : ''}` : 'Waiting on your decision';
  const dueTip = w.due ? ` · the step is due ${dShort(w.due)}` : '';
  if (w.late)
    return (
      <span className="pill over" title={waited + dueTip}>
        {`${plural(w.lateDays, 'day')} late`}
      </span>
    );
  return (
    <span className="pill due" title={waited + dueTip}>
      {w.days !== undefined ? `Needs you · ${w.days}d` : 'Needs you'}
    </span>
  );
}

function WaitingCard({ w }: { w: ApWaiting }) {
  const { base, go, toast, openModal } = useConsole();
  const { user } = useApp();
  const deps = useDecideDeps();
  const [busy, setBusy] = useState(false);
  const canDecide = isAdminOrManager(user?.role);
  const act = AP_ACTION[w.kind];
  const target = { kind: w.kind, engagementId: w.e.id, itemId: w.itemId, title: w.title };

  const approve = async () => {
    setBusy(true);
    try {
      toast(await decideApproval(deps, target, true));
    } catch (e) {
      toast(`Could not ${w.kind === 'client' ? 'accept' : 'approve'} · ${e instanceof Error ? e.message : 'Try again.'}`);
      setBusy(false);
    }
  };
  const reject = () =>
    openModal(
      w.kind === 'board' ? (
        <NoteModal
          title="Send the board resolution back"
          sub={`${w.e.companyName} · prepared by ${w.from.name} (project lead)`}
          label="What should the project lead change"
          placeholder="Tell the project lead what to change."
          hint="Only the project lead hears about it. The client never sees a draft."
          required
          confirm="Send back"
          run={(note) => decideApproval(deps, target, false, note)}
        />
      ) : w.kind === 'fill' ? (
        <NoteModal
          title="Decline this request"
          sub={`${w.title} · ${w.e.companyName} · asked by ${w.from.name} (project lead)`}
          label="Reason for the lead (optional)"
          hint="Nothing is sent to the client."
          confirm="Decline"
          run={(note) => decideApproval(deps, target, false, note)}
        />
      ) : (
        <NoteModal
          title={`Reject ${w.title}`}
          sub={`${w.e.companyName} · ${w.kind === 'lead' ? `sent by ${w.from.name} (project lead)` : `submitted by ${w.from.name} (client)`}`}
          label="Note for the client (optional)"
          placeholder="e.g. Please re-upload a clearer passport scan."
          hint="The step reopens and the client is asked to fix it and submit again. The client, the lead and the managers are told; an email to the client opens for you to send."
          confirm="Reject"
          run={(note) => decideApproval(deps, target, false, note)}
        />
      ),
    );

  return (
    <section className="glass panel mx-ap">
      <div className="mx-aph">
        <ClientAv id={w.e.id} label={companyInitials(w.e.companyName)} />
        <div className="mx-dt">
          <b className="ap-ell" title={`${w.code} ${w.title}`}>{`${w.code} ${w.title}`}</b>
          <span className="ap-ell" title={`${w.e.companyName} · from ${w.from.name} (${w.from.role}) · ${AP_KIND_LABEL[w.kind]}`}>
            {`${w.e.companyName} · from ${w.from.name} (${w.from.role}) · ${AP_KIND_LABEL[w.kind]}`}
          </span>
        </div>
        <WaitingPill w={w} />
      </div>
      <p className="mx-apd">{detailOf(w)}</p>
      {w.note ? (
        <div className="banner info">
          <Icon name="notes" />
          <div>
            <b>{`${w.from.name}’s note`}</b>
            {w.note}
          </div>
        </div>
      ) : null}
      <div className="mx-apa">
        <Btn cls="sm" ico="step" onClick={() => go(stepHref(base, w.e, w.itemId))}>
          Open the step
        </Btn>
        <Btn cls="sm" ico="eye" onClick={() => openModal(<Preview e={w.e} itemId={w.itemId} kind={w.kind} note={w.note} from={w.from.name} />, { cls: 'wide', label: 'Preview' })}>
          Preview
        </Btn>
        <span className="sp" />
        {canDecide ? (
          <>
            <Btn cls="sm" ico={w.kind === 'fill' || w.kind === 'board' ? 'back' : 'x'} disabled={busy} onClick={reject}>
              {act.no}
            </Btn>
            <Btn cls="sm pri" ico="check" disabled={busy} onClick={() => void approve()}>
              {busy ? 'Saving…' : act.yes}
            </Btn>
          </>
        ) : (
          <span className="small">Awaiting project manager or admin approval</span>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- one decided card */

function DecidedCard({ d }: { d: ApDecided }) {
  const { base, go, openModal } = useConsole();
  return (
    <section className={'glass panel mx-ap ' + (d.ok ? 'ok' : 'back')}>
      <div className="mx-aph">
        <ClientAv id={d.e.id} label={companyInitials(d.e.companyName)} />
        <div className="mx-dt">
          <b className="ap-ell" title={`${d.code} ${d.title}`}>{`${d.code} ${d.title}`}</b>
          <span className="ap-ell">{`${d.e.companyName} · from ${d.from.name} (${d.from.role}) · ${AP_KIND_LABEL[d.kind]} · ${stamp(d.at)}${d.by ? ` · by ${d.by}` : ''}`}</span>
        </div>
        <span className={'pill ' + (d.ok ? 'ok' : 'over')}>{d.label}</span>
      </div>
      {d.note ? (
        <div className={'banner ' + (d.ok ? 'ok' : 'over')}>
          <Icon name="notes" />
          <div>
            <b>{d.by === 'You' ? 'Your note' : 'Note'}</b>
            {d.note}
          </div>
        </div>
      ) : null}
      <div className="mx-apa">
        <Btn cls="sm" ico="step" onClick={() => go(stepHref(base, d.e, d.itemId))}>
          Open the step
        </Btn>
        <Btn cls="sm" ico="eye" onClick={() => openModal(<Preview e={d.e} itemId={d.itemId} kind={d.kind} from={d.from.name} />, { cls: 'wide', label: 'Preview' })}>
          Preview
        </Btn>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- preview (prototype mxPreview, real content) */

function Preview({ e, itemId, kind, note, from }: { e: Engagement; itemId: string; kind: ApWaiting['kind']; note?: string; from: string }) {
  const { base, go, closeModal } = useConsole();
  const { state, refreshing } = useFullChecklist(e);
  const item = getItem(itemId);
  const title = item?.title ?? itemId;
  const open = () => {
    closeModal();
    go(stepHref(base, e, itemId));
  };
  const downloadUrl = `/api/engagements/${encodeURIComponent(e.id)}/board-resolution/download`;
  const rows = kind === 'board' ? answerRows('pre-1', state['pre-1'], e.ownershipType) : kind === 'fill' ? [] : answerRows(itemId, state[itemId], e.ownershipType);
  return (
    <ModalBody
      title={title}
      sub={`${e.companyName} · ${kind === 'client' ? `submitted by ${from} (client)` : `prepared by ${from} (project lead)`}`}
      foot={
        <>
          <Btn ico="step" onClick={open}>
            Open the step
          </Btn>
          <span className="sp" />
          {kind === 'board' ? (
            <a className="btn" href={downloadUrl} download>
              <Icon name="dl" />
              Download board resolution
            </a>
          ) : null}
          <Btn cls="pri" onClick={closeModal}>
            Close
          </Btn>
        </>
      }
    >
      {kind === 'board' ? (
        <Island cls="cx-docv">
          <BoardResolutionDocPreview engagementId={e.id} downloadUrl={downloadUrl} />
        </Island>
      ) : null}
      {kind === 'fill' ? (
        <div className="mx-paper small">
          <b>What the client will be asked to fill</b>
          <p>{(item && stepDescription(item)) || 'No description is written for this step yet.'}</p>
          {note ? <p>{`${from}’s note for the client: “${note}”`}</p> : null}
          <ul className="ap-ul">
            {clientFieldLabels(itemId, e.ownershipType).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mx-paper small">
          <b>{kind === 'board' ? 'Client Details used by the board resolution' : 'What was submitted'}</b>
          {refreshing && !rows.length ? (
            <p className="small">Loading the answers…</p>
          ) : rows.length ? (
            <dl className="ap-dl">
              {rows.map((r) => (
                <div key={r.id}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="small">{kind === 'board' ? 'No Client Details yet.' : 'No answers are filled on this step yet.'}</p>
          )}
        </div>
      )}
    </ModalBody>
  );
}

/* ---------------------------------------------------------------- your requests to an admin (live ProjectChangeRequestsPanel, manager view) */

function ChangeRequests() {
  const qc = useQueryClient();
  const { toast, me } = useConsole();
  const today = useTodayIso();
  const q = useQuery({
    queryKey: ['engagement-change-requests', 'pending'],
    queryFn: () => listChangeRequestsFromDb(['pending']),
    staleTime: 15_000,
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => decideChangeRequestInDb(id, 'cancelled'),
    onSuccess: () => {
      toast('Withdrawn · the request has been cancelled');
      void qc.invalidateQueries({ queryKey: ['engagement-change-requests'] });
      void qc.invalidateQueries({ queryKey: ['engagements'] });
    },
    onError: (e) => toast(`Couldn’t record the decision · ${e instanceof Error ? e.message : 'Try again in a moment.'}`),
  });
  const list = q.data ?? [];
  if (q.isLoading || !list.length) return null;
  return (
    <section className="glass panel mx-p">
      <div className="ph">
        <div className="mx-pt">
          <h3>{`Your requests to an admin · ${list.length}`}</h3>
          <span className="small">Changes only an admin can make. They stay here until an admin decides; you can withdraw them until then.</span>
        </div>
      </div>
      {list.map((r) => {
        const busy = withdraw.isPending && withdraw.variables === r.id;
        const company = r.companyName ?? r.preview?.companyName ?? 'Project';
        const mine = r.requestedBy === me?.id;
        return (
          <div key={r.id} className="mx-qi ap-cr">
            <span className="pill mut">{CHANGE_REQUEST_KIND_LABEL[r.kind as ChangeRequestKind] ?? r.kind}</span>
            <span className="mx-dt">
              <b className="ap-ell" title={company}>
                {company}
              </b>
              <span>{`Asked by ${mine ? 'you' : r.requestedByName ?? 'a manager'} · ${dShort(r.createdAt)} · waiting ${plural(Math.max(0, daysBetween(istDay(r.createdAt) ?? today, today)), 'day')}`}</span>
              {(r.preview?.fields ?? []).map((f) => (
                <span key={f.label} className="ap-diff">
                  {f.label}: <s>{f.from}</s> → <b>{f.to}</b>
                </span>
              ))}
              {r.reason ? <span className="ap-diff">{`“${r.reason}”`}</span> : null}
            </span>
            <Btn cls="sm" ico="x" disabled={busy} onClick={() => withdraw.mutate(r.id)}>
              {busy ? 'Withdrawing…' : 'Withdraw'}
            </Btn>
          </div>
        );
      })}
    </section>
  );
}
