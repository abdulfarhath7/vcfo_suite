'use client';

/**
 * STEP PAGE — `/app/client/incorporation/step/[stepId]`, FINAL live layout
 * (`renderLive`, final-src/s/inc/step.html): title row + What's this?, one
 * answers card, the Documents card (requested files + attachments), the phase
 * step list on the right (`naRail`), phone prev/next, and the sticky
 * "Approve & submit" bar with Undo.
 *
 * Real actions: client approve (`POST /api/client/steps/:id/approve`, deferred
 * until the 3.2 s Undo toast closes), request a change
 * (`POST /api/client/change-requests`), upload a requested file
 * (`POST /api/engagements/:id/milestone-documents` →
 * `POST /api/client/steps/:id/files`, with Undo). Answers stay read-only for
 * the client (DECISIONS › Incorporation).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getActiveCatalogItems, type ChecklistField } from '@/data/checklist';
import { resolveChecklistItemFromStepParam } from '@/lib/slug';
import { extractItemResponses, fieldsForOwnership, getClientResponseFields } from '@/lib/checklist-responses';
import { filterFieldsByViewer } from '@/lib/checklist-field-access';
import { applyShowWhen, expandRepeatFields, isRepeatField, repeatFieldLabel, resolveFieldLabels } from '@/lib/checklist-repeat';
import { withoutUnusedDirectorSlots } from '@/lib/incorp-director-slots';
import { approvalStateOf, clientApproveBlockedReason, isAwaitingClientApproval } from '@/lib/checklist-step-approval';
import { isStepReleasedToClient } from '@/lib/checklist-visibility';
import { fileNameFromStoragePath, isMilestoneStoragePath, validateMilestoneUploadFile } from '@/lib/milestone-document-storage';
import type { PortalStep } from '@/lib/client-portal/step-model';
import type { ClientFileRequestDto } from '@/lib/client-portal/incorporation-types';
import { phaseHref, portalHref } from '../../routes';
import { usePortal } from '../../PortalProvider';
import { useDocViewer, triggerDownload, type ViewerDoc } from '../documents/DocViewer';
import { BotSay, Ic, IncFrame, InfoBtn, Si, fmt, fmtL, fmtS, istDay, kb } from './ui';
import {
  INC_EXTRAS_KEY,
  KL,
  PHL,
  firstName,
  glyph,
  kd,
  ownKey,
  signedUrlFor,
  stepAnswer,
  stepHrefOf,
  tipTxt,
  useIncData,
  type IncData,
} from './data';
import { stepFiles } from './StepTable';

/* ---------------- answers ---------------- */

interface Row {
  label: string;
  value: string;
  file?: string;
}

function answerRows(s: PortalStep, ownershipType: IncData['ownershipType']): Row[] {
  const responses = extractItemResponses(s.item, s.slice);
  const base = withoutUnusedDirectorSlots(
    s.item.id,
    filterFieldsByViewer(fieldsForOwnership(s.item.id, getClientResponseFields(s.item), ownershipType), 'client'),
    responses,
  );
  const fields = resolveFieldLabels(applyShowWhen(expandRepeatFields(base, responses), responses), responses);
  const rows: Row[] = [];
  for (const f of fields as ChecklistField[]) {
    if (isRepeatField(f)) continue;
    const raw = String(responses[f.id] ?? '').trim();
    const label = repeatFieldLabel(base, responses, f.id) ?? f.label;
    if (f.type === 'file') {
      rows.push({ label, value: raw ? fileNameFromStoragePath(raw) : '—', file: raw && isMilestoneStoragePath(raw) ? raw : undefined });
      continue;
    }
    let v = raw;
    if (raw && (f.type === 'select' || f.type === 'segmented')) v = f.options?.find((o) => o.value === raw)?.label ?? raw;
    if (raw && f.type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(raw)) v = fmtL(raw.slice(0, 10));
    rows.push({ label, value: v || '—' });
  }
  if (!rows.some((r) => /^remarks/i.test(r.label))) rows.push({ label: 'Remarks (optional)', value: '—' });
  return rows;
}

function liveIntro(s: PortalStep, d: IncData, prev?: PortalStep): string {
  const k = kd(s);
  const sbc = s.owner !== 'client';
  if (k === 'you') return `${d.short}’s team filled this step. Check it, then approve & submit${s.due ? ` by ${fmt(s.due)}` : ''}.`;
  if (k === 'with') return `${d.short}’s team is preparing this step${s.due ? ` (due ${fmt(s.due)})` : ''}. Here is what it captures.`;
  if (k === 'prog') return `Fill this step${s.due ? ` and submit by ${fmt(s.due)}` : ''}. Here is what it captures.`;
  return `${sbc ? `${d.short}’s team prepares this step.` : `${d.short} fills this step once step ${s.n - 1}${prev ? ` · ${prev.title}` : ''} is done.`} Here is what it captures.`;
}

function ftClass(name: string, ct?: string): 'pdf' | 'docx' | 'xlsx' {
  const n = name.toLowerCase();
  if (/\.(xlsx?|csv)$/.test(n) || /sheet|excel/.test(ct ?? '')) return 'xlsx';
  if (/\.(docx?|rtf)$/.test(n) || /word/.test(ct ?? '')) return 'docx';
  return 'pdf';
}

/* ---------------- change-request dialog ---------------- */

function ChangeDialog({ title, onClose, onSend }: { title: string; onClose: () => void; onSend: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const last = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      last?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="cr-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cr-dlg" role="dialog" aria-modal="true" aria-labelledby="cr-t">
        <h2 id="cr-t">Request a change · {title}</h2>
        <textarea ref={ref} value={note} maxLength={2000} aria-label="What should change" placeholder="What should change?" onChange={(e) => setNote(e.target.value)} />
        {err ? <div className="err">{err}</div> : null}
        <div className="row2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn p"
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
            <Ic n="message-square" />
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- the page ---------------- */

export default function StepPage({ stepParam }: { stepParam: string }) {
  const d = useIncData();
  const { go, openChat, toast, drill } = usePortal();
  const qc = useQueryClient();
  const viewer = useDocViewer();
  const item = useMemo(() => resolveChecklistItemFromStepParam(stepParam), [stepParam]);
  const s = item ? d.model.byId[item.id] : undefined;
  const phase = s ? d.model.phases[s.phaseNo - 1] : undefined;
  const catalog = useMemo(() => getActiveCatalogItems(), []);
  const ci = s ? catalog.findIndex((c) => c.id === s.id) : -1;
  const prev = ci > 0 ? d.model.byId[catalog[ci - 1]!.id] : undefined;
  const next = ci >= 0 && ci < catalog.length - 1 ? d.model.byId[catalog[ci + 1]!.id] : undefined;
  const k = s ? kd(s) : 'up';
  const requests: ClientFileRequestDto[] = s ? d.requestsFor(s.id) : [];
  const openReqs = requests.filter((r) => !r.fulfilledAt);
  const files = s ? stepFiles(s, d.ownershipType) : [];
  const reqFields = new Set(requests.map((r) => r.fieldId));
  const otherFiles = files.filter((f) => !reqFields.has(f.fieldId));
  const awaiting = isAwaitingClientApproval(s?.slice);
  const meta = d.extras?.fileMeta ?? {};

  /* ---------- deferred approve with Undo (QUESTIONS: POST after the toast closes) ---------- */
  const [submitted, setSubmitted] = useState(false);
  const pendingApprove = useRef<{ timer: ReturnType<typeof setTimeout>; fire: () => void } | null>(null);
  const doApprove = useCallback(
    async (keepalive = false) => {
      if (!s || !d.engagementId) return;
      try {
        const res = await fetch(`/api/client/steps/${encodeURIComponent(s.id)}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engagementId: d.engagementId }),
          keepalive,
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; phaseApproved?: { title: string } | null };
        if (!res.ok) throw new Error(body.error ?? 'Could not approve this step');
        if (body.phaseApproved) toast(`That completes ${body.phaseApproved.title}. Your team has been told.`);
        d.refresh();
        void qc.invalidateQueries({ queryKey: ['client-overview'] });
      } catch (e) {
        setSubmitted(false);
        toast(e instanceof Error ? e.message : 'Could not approve this step');
      }
    },
    [s, d, qc, toast],
  );
  useEffect(
    () => () => {
      // leaving the page before the toast closes still submits (no silent loss)
      const p = pendingApprove.current;
      if (p) {
        clearTimeout(p.timer);
        p.fire();
      }
    },
    [],
  );

  /* ---------- NOC blocking: scroll to and focus the upload ---------- */
  const docsRef = useRef<HTMLElement>(null);
  const approve = () => {
    if (!s) return;
    if (openReqs.length) {
      const r = openReqs[0]!;
      toast(`Upload the ${r.label} first · it is still needed from ${d.short}`);
      const drop = docsRef.current?.querySelector<HTMLElement>('.drop');
      if (drop) {
        drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
        drop.classList.remove('pulse');
        void drop.offsetWidth;
        drop.classList.add('pulse');
        drop.querySelector<HTMLButtonElement>('.tx>span button')?.focus({ preventScroll: true });
      }
      return;
    }
    if (!awaiting) {
      toast(clientApproveBlockedReason(s.slice) ?? 'This step is not waiting for your approval yet.');
      return;
    }
    setSubmitted(true);
    const fire = () => {
      pendingApprove.current = null;
      void doApprove(true);
    };
    const timer = setTimeout(fire, 3200);
    pendingApprove.current = { timer, fire };
    toast(`Approved & submitted · ${d.leadName ?? 'your project lead'} files it next`, {
      undo: () => {
        const p = pendingApprove.current;
        if (p) clearTimeout(p.timer);
        pendingApprove.current = null;
        setSubmitted(false);
      },
    });
  };

  /* ---------- request a change ---------- */
  const [changeOpen, setChangeOpen] = useState(false);
  const canChange = (() => {
    const st = approvalStateOf(s?.slice);
    return st === 'pending_client' || st === 'client_approved';
  })();
  const requestChange = () => {
    if (!s) return;
    if (canChange) setChangeOpen(true);
    else openChat(`I want to request a change to step ${s.n} · ${s.title}`);
  };
  const sendChange = async (note: string) => {
    if (!s || !d.engagementId) return;
    const res = await fetch('/api/client/change-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engagementId: d.engagementId, stepId: s.id, note }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? 'Could not send the request');
    setChangeOpen(false);
    toast(`Change request sent to ${d.managerName ?? d.leadName ?? 'your team'}`);
    d.refresh();
  };

  /* ---------- upload a requested file (with Undo) ---------- */
  const [busyReq, setBusyReq] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const upload = async (r: ClientFileRequestDto, file: File) => {
    if (!s || !d.engagementId || !d.extras) return;
    const bad = validateMilestoneUploadFile(file);
    if (bad) {
      toast(bad);
      return;
    }
    setBusyReq(r.id);
    try {
      const fd = new FormData();
      fd.set('fieldId', r.fieldId);
      fd.set('stepId', s.id);
      fd.set('file', file);
      const up = await fetch(`/api/engagements/${encodeURIComponent(d.engagementId)}/milestone-documents`, { method: 'POST', body: fd });
      const ub = (await up.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!up.ok || !ub.path) throw new Error(ub.error ?? 'Upload failed');
      const at = await fetch(`/api/client/steps/${encodeURIComponent(s.id)}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: d.extras.engagementId,
          requestId: r.id,
          path: ub.path,
          fileName: file.name,
          sizeBytes: file.size,
          contentType: file.type,
        }),
      });
      const ab = (await at.json().catch(() => ({}))) as { error?: string };
      if (!at.ok) throw new Error(ab.error ?? 'Could not attach the file');
      await qc.invalidateQueries({ queryKey: INC_EXTRAS_KEY });
      d.refresh();
      toast(`${r.label} uploaded · ${firstName(r.requestedByName) || 'your team'} will check it`, {
        undo: () => {
          void fetch(`/api/client/steps/${encodeURIComponent(s.id)}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ engagementId: d.extras!.engagementId, requestId: r.id, undo: true }),
          }).then(() => {
            void qc.invalidateQueries({ queryKey: INC_EXTRAS_KEY });
            d.refresh();
          });
        },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusyReq(null);
    }
  };

  /* ---------- file actions ---------- */
  const viewDocs = (): ViewerDoc[] =>
    files.map((f) => {
      const m = meta[f.path];
      return {
        id: `${s!.id}:${f.fieldId}`,
        name: f.fileName,
        url: () => signedUrlFor(f.path),
        meta: `Step ${s!.n} · ${s!.title}`,
        sizeBytes: m?.sizeBytes,
        contentType: m?.contentType,
        uploadedAt: m?.uploadedAt,
        uploadedBy: m?.uploadedByName,
      };
    });
  const preview = (path: string) => {
    const docs = viewDocs();
    const i = files.findIndex((f) => f.path === path);
    if (i >= 0) viewer.open(docs, i);
    else viewer.open([{ id: path, name: fileNameFromStoragePath(path), url: () => signedUrlFor(path) }], 0);
  };
  const download = async (path: string) => {
    try {
      triggerDownload(await signedUrlFor(path), fileNameFromStoragePath(path));
      toast(`Download started · ${fileNameFromStoragePath(path)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not download the file');
    }
  };

  /* ---------- sticky action bar: lift the Ask VCFO launcher (--vp-launch-lift) ---------- */
  const actRef = useRef<HTMLDivElement>(null);
  const showAct = Boolean(s) && k === 'you';
  useLayoutEffect(() => {
    const cp = document.querySelector<HTMLElement>('.cp');
    const el = actRef.current;
    if (!cp) return;
    if (!showAct || !el) {
      cp.style.removeProperty('--vp-launch-lift');
      return;
    }
    const set = () => cp.style.setProperty('--vp-launch-lift', `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      cp.style.removeProperty('--vp-launch-lift');
    };
  }, [showAct]);

  if (!item) {
    return (
      <IncFrame pending={false} title="Step · Incorporation · VCFO Suite">
        <div className="wrap na">
          <BotSay text="I can’t find that step." btn="All phases" onBtn={() => go(portalHref('incorporation'))} />
        </div>
      </IncFrame>
    );
  }
  if (!s || !phase) {
    return (
      <IncFrame pending title={`${item.title} · Incorporation · VCFO Suite`}>
        <div className="wrap na">
          <section className="card sk-blk" />
        </div>
      </IncFrame>
    );
  }

  const rows = answerRows(s, d.ownershipType);
  const released = k === 'done' || isStepReleasedToClient(s.slice);
  const phl = PHL[s.phaseNo - 1]!;
  const tab = s.item.fields?.find((f) => f.section)?.section ?? s.title;
  const approvedOn = s.doneOn;
  const actItems = requests.length + 2;
  const actDone = requests.filter((r) => r.fulfilledAt).length + 1;
  const actPct = Math.round((actDone / actItems) * 100);
  const ans = stepAnswer(s, d.short);
  const docsCount = requests.length + otherFiles.length;
  const docsDone = requests.filter((r) => r.fulfilledAt).length + otherFiles.length;

  const fileRow = (key: string, name: string, path: string, chipTxt: string) => {
    const m = meta[path];
    const fname = fileNameFromStoragePath(path);
    const by = m?.uploadedByName ? firstName(m.uploadedByName) : undefined;
    const at = m?.uploadedAt ? fmt(istDay(m.uploadedAt)) : undefined;
    const small = [fname, kb(m?.sizeBytes), by, at].filter(Boolean).join(' · ');
    const t = ftClass(fname, m?.contentType);
    return (
      <div className="file" key={key}>
        <span className={`ft ${t}`}>{t.toUpperCase()}</span>
        <span className="tx">
          <b>{name}</b>
          <small>{small}</small>
        </span>
        <span className="acts">
          <span className="chip done">{chipTxt}</span>
          <button type="button" className="sq" aria-label={`Preview ${name}`} onClick={() => preview(path)}>
            <Ic n="eye" />
          </button>
          <button type="button" className="sq" aria-label={`Download ${fname}`} onClick={() => void download(path)}>
            <Ic n="download" />
          </button>
        </span>
      </div>
    );
  };

  const docsCard =
    docsCount > 0 ? (
      <section className="card acc" id="docs" aria-label="Documents" ref={docsRef}>
        <div className="ch">
          <h2 className="lbl">
            Documents
            <InfoBtn
              label="About these documents"
              spec={{
                title: 'Documents',
                text: 'Files this step needs. SBC checks each one before it goes into the MCA filing.',
                answer: { title: 'Documents', text: 'Files this step needs. SBC checks each one before it goes into the MCA filing.', why: 'Missing or old documents are the most common reason MCA sends a filing back.', source: `VCFO Suite · ${d.short}’s incorporation project`, href: stepHrefOf(s) },
              }}
            />
          </h2>
          <span className="sp" />
          {requests.length ? (
            <span className={`chip ${docsDone === docsCount ? 'done' : 'you'}`}>
              {docsDone} of {docsCount}
            </span>
          ) : (
            <span className="cnt">
              {docsCount} file{docsCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {requests.map((r) => {
          const done = Boolean(r.fulfilledAt);
          const reqBy = r.requestedByName ? ` · requested by ${firstName(r.requestedByName)}` : '';
          const path = r.fulfilledPath ?? '';
          return (
            <div key={r.id}>
              <div className="dreq">
                <Si k={done ? 'done' : 'you'} />
                {(r.note ?? r.label) + reqBy}
              </div>
              {done && path ? (
                fileRow(r.id, r.label, path, k === 'done' ? 'Checked' : 'Uploaded')
              ) : (
                <div
                  className={`drop${busyReq === r.id ? ' busy' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('over');
                  }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('over')}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('over');
                    const f = e.dataTransfer.files?.[0];
                    if (f) void upload(r, f);
                  }}
                >
                  <button type="button" className="ut" aria-label={`Upload the ${r.label}`} onClick={() => inputs.current[r.id]?.click()}>
                    <Ic n="upload" />
                  </button>
                  <span className="tx">
                    <b>
                      {r.label}
                      <InfoBtn
                        label={`About the ${r.label}`}
                        spec={{
                          title: r.label,
                          text: r.note ? `${r.note}.` : `${r.label}, asked for by ${r.requestedByName ?? 'your team'} for this step.`,
                          answer: { title: r.label, text: r.note ?? r.label, why: INFO_NOC_WHY, source: `VCFO Suite checklist, step ${s.n}`, href: stepHrefOf(s) },
                        }}
                      />
                    </b>
                    <span>
                      {busyReq === r.id ? (
                        'Uploading…'
                      ) : (
                        <>
                          Drop a file here or{' '}
                          <button type="button" onClick={() => inputs.current[r.id]?.click()}>
                            browse
                          </button>
                        </>
                      )}
                    </span>
                  </span>
                  {r.dueDate ? <span className="chip you">Due {fmt(r.dueDate)}</span> : null}
                  <input
                    ref={(el) => {
                      inputs.current[r.id] = el;
                    }}
                    className="vh"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                    aria-label={`Choose the ${r.label}`}
                    tabIndex={-1}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void upload(r, f);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {otherFiles.map((f) => (
          <div key={f.fieldId}>
            {requests.length ? (
              <div className="dreq">
                <Si k="done" />
                {f.label}
              </div>
            ) : null}
            {fileRow(f.fieldId, f.label, f.path, k === 'done' ? 'Checked' : 'Uploaded')}
          </div>
        ))}
      </section>
    ) : null;

  const moreFor = (y: PortalStep) => {
    const fs = stepFiles(y, d.ownershipType);
    const resp = extractItemResponses(y.item, y.slice);
    const need = getClientResponseFields(y.item).filter((f) => f.type === 'file' && !String(resp[f.id] ?? '').trim());
    drill({
      title: `Step ${y.n} · ${y.title}`,
      sub: `${KL[kd(y)]} · attachments`,
      tabs: [
        {
          label: 'Attached',
          color: '#15805f',
          rows: fs.map((f) => ({
            title: f.label,
            meta: f.fileName,
            chip: 'Open',
            chipColor: '#2453c7',
            onOpen: () => viewer.open(fs.map((x) => ({ id: `${y.id}:${x.fieldId}`, name: x.fileName, url: () => signedUrlFor(x.path), meta: `Step ${y.n} · ${y.title}` })), fs.indexOf(f)),
          })),
        },
        {
          label: 'Still needed',
          color: '#d9731f',
          rows: need.map((f) => ({ title: f.label, meta: y.owner === 'client' ? `From ${d.short}` : 'SBC prepares', href: stepHrefOf(y) })),
        },
      ],
      active: fs.length ? 0 : 1,
    });
  };

  return (
    <IncFrame pending={d.pending} title={`${s.title} · Incorporation · VCFO Suite`}>
      <div className="wrap na">
        <div className="nah">
          <button type="button" className="nabk" aria-label={`Back to ${phl}`} onClick={() => go(phaseHref(s.phaseNo))}>
            <Ic n="chevron-left" />
          </button>
          <h1>{s.title}</h1>
          <button type="button" className="naw" aria-label={`What’s this? ${s.title}`} onClick={() => openChat(`What’s this: ${s.title}?`, ans)}>
            <Ic n="circle-help" />
            What’s this?
          </button>
        </div>
        <div className="nag">
          <div className="nam">
            <section className="card nac" aria-label={s.title}>
              {k === 'done' ? (
                <>
                  <div className="natabs" role="tablist" aria-label="Sections">
                    <button
                      type="button"
                      className="natab"
                      role="tab"
                      aria-selected="true"
                      id="na-t1"
                      aria-controls="na-p1"
                      onClick={() => toast(`Already showing ${tab}`)}
                    >
                      <Ic n="check" />
                      {tab}
                    </button>
                  </div>
                  <div className="nabd" role="tabpanel" id="na-p1" aria-labelledby="na-t1">
                    <div className="naok done" role="status">
                      <Ic n="circle-check" />
                      <div>
                        <b>{s.owner === 'client' ? 'Approved' : 'Completed'}</b>
                        <span>
                          {s.owner === 'client' ? 'Accepted after submission on ' : 'Delivered by SBC on '}
                          {fmtS(approvedOn)}.
                        </span>
                      </div>
                    </div>
                    <dl className="nakv" style={{ margin: '22px 20px 0' }}>
                      {rows.map((r, i) => (
                        <KvRow key={`${r.label}-${i}`} r={r} onFile={preview} />
                      ))}
                    </dl>
                  </div>
                </>
              ) : (
                <div className="nabd">
                  <p className="nain">{liveIntro(s, d, prev)}</p>
                  <dl className="nakv">
                    {rows.map((r, i) => (
                      <KvRow key={`${r.label}-${i}`} r={released ? r : { label: r.label, value: '—' }} onFile={preview} />
                    ))}
                  </dl>
                </div>
              )}
            </section>
            {docsCard}
            {k === 'done' ? (
              <div className="naf">
                <button type="button" className="btn nachg" onClick={requestChange}>
                  <Ic n="message-square" />
                  Request a change
                </button>
              </div>
            ) : null}
          </div>
          <aside className="card narail" aria-label={`${phl} steps`}>
            <h2>{phl}</h2>
            <div className="nal">
              {phase.steps.map((y, i) => {
                const ky = kd(y);
                const cur = y.id === s.id;
                const tip = tipTxt(y);
                const o = ownKey(y);
                return (
                  <div className={`nar k-${ky}${cur ? ' cur' : ''}`} key={y.id}>
                    {ky === 'up' && !y.late ? (
                      <span className="si num" role="img" aria-label={tip} data-tt={tip}>
                        {i + 1}
                      </span>
                    ) : (
                      <Si k={glyph(y)} tip={tip} />
                    )}
                    <a
                      href={stepHrefOf(y)}
                      className="nm"
                      aria-current={cur ? 'page' : undefined}
                      aria-label={`Step ${y.n} · ${y.title}`}
                      onClick={(e) => {
                        e.preventDefault();
                        go(stepHrefOf(y));
                      }}
                    >
                      <span>{y.title}</span>
                      <span
                        className={`ow ${o === 'You' ? 'You' : 'SBC'}`}
                        role="img"
                        aria-label={`Owner · ${o === 'You' ? d.short : o}`}
                        data-tt={o === 'You' ? `${d.short} owns this step` : `${o} owns this step`}
                      >
                        <Ic n="user" />
                      </span>
                    </a>
                    <button
                      type="button"
                      className="ib"
                      aria-label={`More for step ${y.n} · ${y.title}`}
                      data-tt="More"
                      data-notip=""
                      onClick={() => moreFor(y)}
                    >
                      <Ic n="more" />
                    </button>
                    <button
                      type="button"
                      className="ib"
                      aria-label={`What’s this? ${y.title}`}
                      data-tt="What’s this? · ask VCFO"
                      data-notip=""
                      onClick={() => openChat(`What’s this: ${y.title}?`, stepAnswer(y, d.short))}
                    >
                      <Ic n="circle-help" />
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
        <nav className="pn" aria-label="Steps">
          {prev ? (
            <button type="button" className="btn" onClick={() => go(stepHrefOf(prev))}>
              <Ic n="arrow-left" />
              <span>
                {prev.n} · {prev.title}
              </span>
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => go(portalHref('incorporation'))}>
              <Ic n="arrow-left" />
              <span>All phases</span>
            </button>
          )}
          {next ? (
            <button type="button" className="btn" onClick={() => go(stepHrefOf(next))}>
              <span>
                {next.n} · {next.title}
              </span>
              <Ic n="arrow-right" />
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => go(portalHref('incorporation'))}>
              <span>All phases</span>
              <Ic n="arrow-right" />
            </button>
          )}
        </nav>
        {showAct ? (
          <div className="act" role="region" aria-label="Approval" ref={actRef}>
            <div className="in">
              <div className="st">
                <Si k="you" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b>Awaiting {d.short}’s approval</b>
                  <span className="tr">
                    <i style={{ width: `${Math.max(actPct, 6)}%` }} />
                  </span>
                </span>
              </div>
              <div className="bs">
                <button type="button" className="btn" onClick={requestChange}>
                  <Ic n="message-square" />
                  Request a change
                </button>
                <button type="button" className="btn p" disabled={submitted} onClick={approve} title={!awaiting && !openReqs.length ? clientApproveBlockedReason(s.slice) ?? undefined : undefined}>
                  <Ic n="check" />
                  {submitted ? 'Submitted' : 'Approve & submit'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {changeOpen ? <ChangeDialog title={`Step ${s.n} · ${s.title}`} onClose={() => setChangeOpen(false)} onSend={sendChange} /> : null}
      {viewer.node}
    </IncFrame>
  );
}

const INFO_NOC_WHY = 'Without it MCA rejects the registered office proof.';

function KvRow({ r, onFile }: { r: Row; onFile: (path: string) => void }) {
  const no = r.value === '—';
  return (
    <div>
      <dt>{r.label}</dt>
      <dd className={no ? 'no' : undefined}>
        {r.file ? (
          <button type="button" className="nalk" aria-label={`Open ${r.value}`} onClick={() => onFile(r.file!)}>
            <Ic n="external-link" />
            {r.value}
          </button>
        ) : (
          r.value
        )}
      </dd>
    </div>
  );
}
