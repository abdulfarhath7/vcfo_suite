'use client';

/**
 * CONTRACT (used by the Incorporation walkthrough, Registrations and the new-client seat's Master data /
 * Declarations — keep the signature):
 *
 *   <StepWork stepId="pre-13" />
 *
 * Renders the client's REAL work for one checklist step inside the new look: the shared step form (fill, save draft,
 * submit / send to SBC), file requests and uploads, approve / request changes, the board-resolution document stage
 * and sign-offs, exactly what the previous portal's step page let the client do. Renders a short read-only
 * summary when the client has nothing to do on that step.
 *
 * `stepId` may be a step id (pre-13) or a catalog slug (capital-structure).
 *
 * What it reuses (unchanged rules):
 *  - the shared `MilestoneResponseForm` (variant client) for a direct-flow step the client fills
 *    (src/lib/pre-inc-direct-flow.ts: lead-only NIC codes stay read-only, submit / waiting-on-lead as before);
 *  - `POST /api/client/steps/:id/approve` when a step waits for the client's approval
 *    (blocked while a requested file is missing, as the server also enforces);
 *  - `POST /api/client/change-requests` (only when the step is with the client or approved by them; otherwise
 *    the request goes to Ask VCFO, as before);
 *  - requested files: `POST /api/engagements/:id/milestone-documents` → `POST /api/client/steps/:id/files`;
 *  - the board-resolution stage for steps 2–3 (BoardStage).
 */
import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { approvalStateOf, clientApproveBlockedReason, isAwaitingClientApproval } from '@/lib/checklist-step-approval';
import { isStepReleasedToClient } from '@/lib/checklist-visibility';
import { isDirectFlowStep, isDirectFlowStepComplete, isWaitingOnLead } from '@/lib/pre-inc-direct-flow';
import { validateMilestoneUploadFile, fileNameFromStoragePath } from '@/lib/milestone-document-storage';
import type { PortalStep } from '@/lib/client-portal/step-model';
import type { ClientFileRequestDto, ClientIncorporationExtras } from '@/lib/client-portal/incorporation-types';
import { MilestoneResponseForm } from '@/views/incorporation/MilestoneResponseForm';
import { usePortal } from '../../runtime';
import { ModalBox } from '../../overlays';
import { Btn, Icon, Pill } from '../../ui';
import { fmt, fmtStamp } from '../../dates';
import { useIncorporationExtras, usePortalIncorporation, useRefreshPortal } from '../../data';
import { resolveStepId } from './model';
import { answerRows, firstName, openInTab, signedUrlFor, stepFiles } from './files';
import { FileRow, fileKind } from './FileRow';
import { BoardStage } from './BoardStage';
import '../../css/95-incorporation.css';
import '../../css/95-incorporation-tw.css';

/** What StepWork shows for a step (the walkthrough uses it to decide on `extra` / `noFoot`). */
export interface StepWorkPlan {
  board: boolean;
  /** the client fills the shared form here (it brings its own Save / Submit) */
  form: boolean;
  /** waiting for the client's approval */
  approve: boolean;
  /** open file requests */
  uploads: number;
  /** anything for the client to act on */
  actionable: boolean;
}

export function planStepWork(s: PortalStep | undefined, extras: ClientIncorporationExtras | null | undefined, canFill: boolean): StepWorkPlan {
  if (!s) return { board: false, form: false, approve: false, uploads: 0, actionable: false };
  const board = s.id === 'pre-2' || s.id === 'pre-3';
  const awaiting = isAwaitingClientApproval(s.slice);
  const form =
    canFill &&
    s.owner === 'client' &&
    isDirectFlowStep(s.id) &&
    (s.kind === 'you' || s.kind === 'prog') &&
    !awaiting &&
    !isDirectFlowStepComplete(s.id, s.slice) &&
    !isWaitingOnLead(s.id, s.slice);
  const uploads = (extras?.fileRequests ?? []).filter((r) => r.stepId === s.id && !r.fulfilledAt).length;
  const boardOpen = board && s.kind !== 'done' && (s.kind === 'you' || s.kind === 'prog');
  return { board, form, approve: awaiting, uploads, actionable: form || awaiting || uploads > 0 || boardOpen };
}

/** The plan for a step id, from the live data (hook form of planStepWork). */
export function useStepWorkPlan(stepId: string): StepWorkPlan {
  const { model, engagement } = usePortalIncorporation();
  const extras = useIncorporationExtras();
  const id = resolveStepId(stepId);
  return planStepWork(id ? model.byId[id] : undefined, extras.data, Boolean(engagement));
}

export function StepWork({ stepId, onDone }: { stepId: string; onDone?: () => void }) {
  const { toast, openModal, closeModal, shell, isLight } = usePortal();
  const { model, engagement, loading } = usePortalIncorporation();
  const extrasQ = useIncorporationExtras();
  const refresh = useRefreshPortal();
  const { engagements } = useApp();
  const id = resolveStepId(stepId);
  const s = id ? model.byId[id] : undefined;
  const short = shell?.companyShort || 'your company';
  const lead = shell?.team.find((t) => t.role === 'Project Lead')?.name;
  const extras = extrasQ.data;
  const formEngagement = engagement ? engagements.find((e) => e.id === engagement.id) ?? engagement : undefined;
  const plan = planStepWork(s, extras, Boolean(formEngagement));

  const requests: ClientFileRequestDto[] = useMemo(() => (extras?.fileRequests ?? []).filter((r) => r.stepId === s?.id), [extras, s?.id]);
  const openReqs = requests.filter((r) => !r.fulfilledAt);
  const files = useMemo(() => (s ? stepFiles(s, engagement?.ownershipType) : []), [s, engagement?.ownershipType]);
  const reqFields = new Set(requests.map((r) => r.fieldId));
  const otherFiles = files.filter((f) => !reqFields.has(f.fieldId));
  const meta = extras?.fileMeta ?? {};
  const [busyReq, setBusyReq] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const requestStepChange = useRequestChange();

  if (!id) return <div className="sw-note">This step is not on your checklist.</div>;
  if (!s) return <div className="sw-note">{loading ? 'Loading this step…' : 'This step is not on your checklist.'}</div>;

  const step = s;
  const engId = engagement?.id;

  /* ---------- approve (the server also blocks while a requested file is missing) ---------- */
  const doApprove = async () => {
    if (!engId) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/client/steps/${encodeURIComponent(step.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: engId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; phaseApproved?: { title: string } | null };
      if (!res.ok) throw new Error(body.error ?? 'Could not approve this step');
      closeModal();
      toast(body.phaseApproved ? `That completes ${body.phaseApproved.title}. Your team has been told.` : `Approved & submitted · ${lead ?? 'your project lead'} files it next`);
      refresh();
      onDone?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not approve this step');
    } finally {
      setApproving(false);
    }
  };
  const approve = () => {
    if (openReqs.length) {
      toast(`Upload the ${openReqs[0]!.label} first · it is still needed from ${short}`);
      return;
    }
    const blocked = clientApproveBlockedReason(step.slice);
    if (blocked) {
      toast(blocked);
      return;
    }
    openModal(<ApproveBox step={step} onApprove={doApprove} />, { label: 'Approve this step' });
  };

  const requestChange = () => requestStepChange(step);

  /* ---------- upload a requested file ---------- */
  const upload = async (r: ClientFileRequestDto, file: File) => {
    if (!engId || !extras) return;
    const bad = validateMilestoneUploadFile(file);
    if (bad) {
      toast(bad);
      return;
    }
    setBusyReq(r.id);
    try {
      const fd = new FormData();
      fd.set('fieldId', r.fieldId);
      fd.set('stepId', step.id);
      fd.set('file', file);
      const up = await fetch(`/api/engagements/${encodeURIComponent(engId)}/milestone-documents`, { method: 'POST', body: fd });
      const ub = (await up.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!up.ok || !ub.path) throw new Error(ub.error ?? 'Upload failed');
      const at = await fetch(`/api/client/steps/${encodeURIComponent(step.id)}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: extras.engagementId, requestId: r.id, path: ub.path, fileName: file.name, sizeBytes: file.size, contentType: file.type }),
      });
      const ab = (await at.json().catch(() => ({}))) as { error?: string };
      if (!at.ok) throw new Error(ab.error ?? 'Could not attach the file');
      refresh();
      toast(`${r.label} uploaded · ${firstName(r.requestedByName) || 'your team'} will check it`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusyReq(null);
    }
  };
  const undoUpload = async (r: ClientFileRequestDto) => {
    if (!extras) return;
    try {
      const res = await fetch(`/api/client/steps/${encodeURIComponent(step.id)}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: extras.engagementId, requestId: r.id, undo: true }),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(b.error ?? 'Could not remove the file');
      refresh();
      toast(`${r.label} removed · upload it again when ready`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove the file');
    }
  };

  const fileMeta = (path: string, by?: string) => {
    const m = meta[path];
    const kb = m?.sizeBytes ? `${Math.max(1, Math.round(m.sizeBytes / 1024))} KB` : undefined;
    return [fileNameFromStoragePath(path), kb, firstName(m?.uploadedByName ?? by) || undefined, m?.uploadedAt ? fmtStamp(m.uploadedAt) : undefined].filter(Boolean).join(' · ');
  };
  const open = (path: string) => openInTab(() => signedUrlFor(path), toast);

  const released = step.kind === 'done' || isStepReleasedToClient(step.slice, step.id);
  const rows = plan.form ? [] : answerRows(step, engagement?.ownershipType, new Set([...reqFields, ...otherFiles.map((f) => f.fieldId)]));
  const shownRows = released ? rows : [];
  const anyValue = shownRows.some((r) => r.value !== '—');
  const waitingLead = isWaitingOnLead(step.id, step.slice);

  return (
    <div className="sw" data-step={step.id}>
      {plan.board ? <BoardStage /> : null}

      {plan.form && formEngagement ? (
        <div className="sw-blk">
          <div className="sw-h">
            <span className="eyebrow">Your answers</span>
            <span className="sp" />
            {step.due ? <Pill kind={step.late ? 'over' : 'due'}>{step.late ? `Was due ${fmt(step.due)}` : `Due ${fmt(step.due)}`}</Pill> : null}
          </div>
          <p className="sw-intro">
            Fill this step{step.due ? ` and submit by ${fmt(step.due)}` : ''}. Your answers save as you type; Submit sends them to {lead ? firstName(lead) : 'your project lead'}.
          </p>
          <div className={'sw-tw sw-form' + (isLight ? '' : ' dark')}>
            <MilestoneResponseForm
              key={`${step.id}-${formEngagement.id}`}
              item={step.item}
              clientId={formEngagement.clientId}
              engagementId={formEngagement.id}
              variant="client"
              open
              compactChrome
              sectionTabs
            />
          </div>
        </div>
      ) : null}

      {waitingLead ? (
        <div className="banner info">
          <Icon name="clock" />
          <div>
            <b>Submitted · waiting on {lead ? firstName(lead) : 'your project lead'}</b>
            <span>Your part is done. Your project lead fills the last fields (such as the NIC codes) and completes the step.</span>
          </div>
        </div>
      ) : null}

      {plan.approve ? (
        <div className="banner due">
          <Icon name="clock" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Waiting for {short}’s approval</b>
            <span>
              {short}’s team filled this step. Check it, then approve & submit{step.due ? ` by ${fmt(step.due)}` : ''}.
              {openReqs.length ? ` Upload the ${openReqs[0]!.label} first.` : ''}
            </span>
            <div className="sw-acts">
              <Btn cls="sm pri" ico="check" onClick={approve} disabled={approving}>
                Approve & submit
              </Btn>
              <Btn cls="sm" ico="send" onClick={requestChange}>
                Request a change
              </Btn>
            </div>
          </div>
        </div>
      ) : null}

      {requests.length || otherFiles.length ? (
        <div className="sw-blk">
          <div className="sw-h">
            <span className="eyebrow">Documents</span>
            <span className="sp" />
            {requests.length ? (
              <Pill kind={openReqs.length ? 'due' : 'done'}>
                {requests.length - openReqs.length + otherFiles.length} of {requests.length + otherFiles.length}
              </Pill>
            ) : (
              <span className="small">
                {otherFiles.length} file{otherFiles.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {requests.map((r) => {
            const done = Boolean(r.fulfilledAt && r.fulfilledPath);
            if (done)
              return (
                <FileRow
                  key={r.id}
                  name={r.label}
                  meta={fileMeta(r.fulfilledPath!, r.fulfilledByName)}
                  kind={fileKind(r.fileName ?? r.fulfilledPath!, r.contentType)}
                  chip={<Pill kind="done">{step.kind === 'done' ? 'Checked' : 'Uploaded'}</Pill>}
                  onOpen={() => open(r.fulfilledPath!)}
                  extra={
                    step.kind !== 'done' ? (
                      <button type="button" className="ib sw-ib" aria-label={`Remove ${r.label}`} title="Remove and upload again" onClick={() => void undoUpload(r)}>
                        <Icon name="x" />
                      </button>
                    ) : null
                  }
                />
              );
            return (
              <label key={r.id} className={'drop' + (busyReq === r.id ? ' sw-busy' : '')}>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  aria-label={`Choose the ${r.label}`}
                  disabled={busyReq === r.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void upload(r, f);
                  }}
                />
                <b>{busyReq === r.id ? 'Uploading…' : `Upload: ${r.label}`}</b>
                <span>
                  {[r.note, r.requestedByName ? `asked by ${firstName(r.requestedByName)}` : '', r.dueDate ? `due ${fmt(r.dueDate)}` : '', 'PDF, Word or image']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </label>
            );
          })}
          {otherFiles.map((f) => (
            <FileRow
              key={f.fieldId}
              name={f.label}
              meta={fileMeta(f.path)}
              kind={fileKind(f.fileName, meta[f.path]?.contentType)}
              chip={<Pill kind="done">{step.kind === 'done' ? 'Checked' : 'Uploaded'}</Pill>}
              onOpen={() => open(f.path)}
            />
          ))}
        </div>
      ) : null}

      {anyValue ? (
        <div className="sw-blk">
          <div className="sw-h">
            <span className="eyebrow">{step.kind === 'done' ? (step.owner === 'client' ? 'What you submitted' : 'What SBC delivered') : 'On record so far'}</span>
          </div>
          <div className="caps sw-caps">
            {shownRows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="cap">
                <div className="sw-cap-l">{r.label}</div>
                {r.file ? (
                  <button type="button" className="v y sw-link" onClick={() => open(r.file!)}>
                    <Icon name="ext" size={13} /> {r.value}
                  </button>
                ) : (
                  <span className={'v sw-v' + (r.value !== '—' ? ' y' : '')}>{r.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!plan.actionable && !plan.board && !waitingLead ? <NothingToDo step={step} short={short} /> : null}

      {step.kind === 'done' && !plan.approve ? (
        <div className="sw-acts">
          <Btn cls="sm" ico="send" onClick={requestChange}>
            Request a change
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Request a change on a step (previous step page): a step with the client or approved by them gets the
 * change-request dialog (POST /api/client/change-requests, the step reopens); any other step goes to Ask VCFO.
 */
export function useRequestChange(): (step: PortalStep) => void {
  const { toast, openChat, openModal, closeModal, shell } = usePortal();
  const { engagement } = usePortalIncorporation();
  const refresh = useRefreshPortal();
  const lead = shell?.team.find((t) => t.role === 'Project Lead')?.name;
  const manager = shell?.team.find((t) => t.role === 'Project Manager')?.name;
  const engId = engagement?.id;
  return (step: PortalStep) => {
    const st = approvalStateOf(step.slice);
    if (!(st === 'pending_client' || st === 'client_approved') || !engId) {
      openChat(`I want to request a change to step ${step.n} · ${step.title}`);
      return;
    }
    const send = async (note: string) => {
      const res = await fetch('/api/client/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: engId, stepId: step.id, note }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not send the request');
      closeModal();
      toast(`Change request sent to ${manager ?? lead ?? 'your team'}`);
      refresh();
    };
    openModal(<ChangeBox title={`Step ${step.n} · ${step.title}`} onSend={send} />, { label: 'Request a change' });
  };
}

/** Read-only line when nothing on the step is the client's to do. */
function NothingToDo({ step, short }: { step: PortalStep; short: string }) {
  if (step.kind === 'done') return null;
  const who = step.owner === 'mca' ? 'The Ministry of Corporate Affairs is processing this' : step.owner === 'client' ? `${short} fills this step once the step before it is done` : 'SBC handles this step';
  return (
    <div className="banner info">
      <Icon name="check" />
      <div>
        <b>Nothing for you to do here right now</b>
        <span>
          {who}
          {step.kind === 'up' || step.kind === 'next' ? '. It opens once the steps before it are done.' : '. You are told when it moves.'}
        </span>
      </div>
    </div>
  );
}

function ApproveBox({ step, onApprove }: { step: PortalStep; onApprove: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <ModalBox
      eyebrow={`Step ${step.n}`}
      title={`Approve ${step.title}?`}
      sub="Approving sends the step on to SBC to file. If something needs to change, request a change instead."
      foot={
        <>
          <button type="button" className="btn" data-close="">
            Cancel
          </button>
          <Btn
            cls="pri"
            ico="check"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onApprove();
              setBusy(false);
            }}
          >
            {busy ? 'Approving…' : 'Approve & submit'}
          </Btn>
        </>
      }
    />
  );
}

function ChangeBox({ title, onSend }: { title: string; onSend: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <ModalBox
      eyebrow="Request a change"
      title={title}
      sub="Tell your team what should change. They are emailed your words and the step reopens."
      foot={
        <>
          <button type="button" className="btn" data-close="">
            Cancel
          </button>
          <Btn
            cls="pri"
            ico="send"
            disabled={!note.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await onSend(note.trim());
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Could not send the request');
                setBusy(false);
              }
            }}
          >
            {busy ? 'Sending…' : 'Send'}
          </Btn>
        </>
      }
    >
      <div className={'mf' + (err ? ' bad' : '')} style={{ marginTop: 16 }}>
        <label className="mf-l" htmlFor="sw-change">
          What should change
        </label>
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the modal opens for this one field */}
        <textarea id="sw-change" autoFocus value={note} maxLength={2000} rows={4} onChange={(e) => setNote(e.target.value)} />
        <div className="mf-m">{err}</div>
      </div>
    </ModalBox>
  );
}
