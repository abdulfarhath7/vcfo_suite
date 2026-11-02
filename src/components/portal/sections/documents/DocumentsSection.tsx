'use client';

/**
 * Documents (prototype a5_docs.js, body.txt DOCUMENTS + #docm): the "Still
 * needed from you" upload strip, phase / status / Replaced / find filters,
 * one card per step with its document rows, the document card popover and
 * the preview modal.
 *
 * Real data: GET /api/client/documents (every file the client may see, merged
 * on the server from checklist uploads, shared index rows, the finalized board
 * resolution and document requests) + the shared step model for phase and
 * step names. Real actions: upload against an OPEN request
 * (POST /api/client/documents/requests/:id/upload, Undo = DELETE within 10
 * minutes), view / download a file (/api/client/documents/file?ref=), one zip
 * of everything (/api/client/documents/zip?folder=all), verify on the issuing
 * portal. Uploads are only possible against open requests — SBC asks, the
 * client answers — so "Replace" appears only when SBC asked for a new file.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { DocNode, OpenRequest } from '@/lib/client-portal/documents';
import { validateMilestoneUploadFile } from '@/lib/milestone-document-storage';
import { useNavBadge, usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { useClientDocuments, usePortalIncorporation, useRefreshPortal } from '../../data';
import { fmt, fmtY, todayIso } from '../../dates';
import { ModalBox, PopHead } from '../../overlays';
import { Btn, GoArrow, Icon, Pill, SecError, SecHead, SecLoading, Seg } from '../../ui';
import { UPLOAD_STRIP_ID, uploadCardId, useDocActions } from './actions';
import {
  buildTree,
  counts,
  docState,
  docStateLabel,
  DST,
  earlierVersions,
  fileKindOf,
  fileUrl,
  live,
  matches,
  previewModeOf,
  reuploadRequest,
  sizeLabel,
  specChips,
  type DocFilter,
  type DocStepGroup,
  type StatFilter,
} from './model';
import '../../css/95-documents.css';

const dateOf = (n: DocNode): string => (n.date ? fmtY(todayIso(new Date(n.date).getTime())) : '—');

/** Same-origin download of a file (the file route honours `dl=1`). */
function download(href: string, name?: string) {
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  a.download = name ?? '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ================================================================ section */

interface Sent {
  requestId: string;
  fileId: string;
  label: string;
  stepId?: string;
  fileName: string;
}

export function DocumentsSection() {
  const { shell, toast, openPop, go } = usePortal();
  const q = useClientDocuments();
  const { model, loading: modelLoading } = usePortalIncorporation();
  const refresh = useRefreshPortal();
  const [f, setF] = useState<DocFilter>({ phase: 'all', stat: 'all', rep: false, q: '' });
  /** Uploads sent this session (the request has left the open list; the card stays as "In review" with Undo). */
  const [sent, setSent] = useState<Sent[]>([]);
  const [zipping, setZipping] = useState(false);

  const data = q.data;
  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const open = useMemo(() => data?.openRequests ?? [], [data]);
  const tree = useMemo(() => buildTree(nodes, model), [nodes, model]);
  const c = useMemo(() => counts(nodes), [nodes]);
  const lead = shell?.team.find((t) => t.role === 'Project Lead')?.name.split(/\s+/)[0] ?? shell?.team.find((t) => t.role === 'Project Manager')?.name.split(/\s+/)[0] ?? 'SBC';

  useNavBadge('documents', open.length || undefined);

  const stepTitle = useCallback(
    (stepId?: string) => {
      const s = stepId ? model.byId[stepId] : undefined;
      return s ? `Step ${s.n} · ${s.title}` : 'Other documents';
    },
    [model],
  );

  /* search palette: one item per live document */
  const palette = useMemo<PaletteItem[]>(
    () =>
      live(nodes).map((n) => {
        const st = docState(n);
        return {
          id: `doc:${n.id}`,
          label: n.label,
          kind: `Document · ${docStateLabel(n)}`,
          sw: st === 'ok' ? 'var(--ok-green)' : st === 'review' ? 'var(--ice)' : st === 'over' ? 'var(--over)' : 'var(--due)',
          go: () => {
            go('documents');
            if (st === 'req' || st === 'over') return;
            window.setTimeout(() => openPop(null, <DocCard id={n.id} />, { kind: 'doc' }), 500);
          },
        };
      }),
    [nodes, go, openPop],
  );
  usePaletteItems('documents', palette);

  /* zip of everything */
  const zipAll = async () => {
    if (zipping) return;
    setZipping(true);
    toast('Preparing your documents…');
    try {
      const res = await fetch('/api/client/documents/zip?folder=all');
      if (!res.ok) throw new Error(res.status === 404 ? 'No files to download yet' : 'Could not prepare the zip');
      const blob = await res.blob();
      const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') ?? '')?.[1];
      const url = URL.createObjectURL(blob);
      download(url, name ? decodeURIComponent(name) : `${shell?.companyShort ?? 'documents'}-documents.zip`);
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast(`Downloaded ${res.headers.get('X-Zip-Files') ?? ''} files`.replace('  ', ' '));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not prepare the zip');
    } finally {
      setZipping(false);
    }
  };

  const onSent = (s: Sent) => {
    setSent((l) => [...l.filter((x) => x.requestId !== s.requestId), s]);
    refresh();
    toast(`Sent to ${lead} for review`);
  };
  const undo = async (s: Sent) => {
    try {
      const res = await fetch(`/api/client/documents/requests/${encodeURIComponent(s.requestId)}/upload?file=${encodeURIComponent(s.fileId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('This upload can no longer be undone');
      setSent((l) => l.filter((x) => x.requestId !== s.requestId));
      refresh();
      toast(`${s.label}: upload undone`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not undo');
    }
  };
  // a request that is open again (Undo, or SBC asked again) drops its "sent" card
  useEffect(() => {
    setSent((l) => l.filter((s) => !open.some((r) => r.id === s.requestId)));
  }, [open]);

  if (q.isPending || modelLoading) {
    return (
      <>
        <SecHead title="Documents" />
        <SecLoading />
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        <SecHead title="Documents" />
        <SecError message="Your documents could not load." onRetry={() => void q.refetch()} />
      </>
    );
  }
  const accept = data?.accept ?? { exts: ['pdf', 'jpg', 'png', 'docx'], maxLabel: '50 MB' };

  const phaseOpts = [
    { value: 'all', label: 'All phases', n: c.total },
    ...tree.map((p) => ({ value: p.id, label: p.id === 'other' ? 'Other' : p.tag.replace('PHASE ', 'Phase '), n: live(p.steps.flatMap((s) => s.docs)).length })),
  ];
  const statOpts: { value: StatFilter; label: string; n?: number }[] = [
    { value: 'all', label: 'Any' },
    { value: 'ok', label: 'Approved' },
    { value: 'review', label: 'In review' },
    { value: 'need', label: 'Needed', n: c.need || undefined },
  ];
  const shownPhases = tree
    .filter((p) => f.phase === 'all' || p.id === f.phase)
    .map((p) => ({ ...p, steps: p.steps.map((s) => ({ ...s, shown: s.docs.filter((d) => matches(d, f)) })).filter((s) => s.shown.length) }))
    .filter((p) => p.steps.length);
  const empty = nodes.length === 0 && open.length === 0 && sent.length === 0;

  return (
    <>
      <SecHead title="Documents" count={nodes.length ? `${c.received} of ${c.total} received` : undefined}>
        {c.received > 0 ? (
          <Btn ico="dl" onClick={() => void zipAll()} disabled={zipping}>
            Download all
          </Btn>
        ) : null}
      </SecHead>

      {empty ? (
        <p className="small" style={{ padding: '20px 0' }}>
          No documents on record yet. Papers SBC issues for {shell?.companyShort ?? 'your company'} and files you upload appear here.
        </p>
      ) : null}

      <div className="upc" id={UPLOAD_STRIP_ID}>
        {open.map((r) => (
          <UploadCard key={r.id} r={r} accept={accept} stepTitle={stepTitle(r.stepId)} onSent={onSent} />
        ))}
        {sent.map((s) => (
          <section key={s.requestId} className="glass upcard fadein done" id={uploadCardId(s.requestId)} data-step={s.stepId}>
            <div className="up-h">
              <span className="up-ic">
                <Icon name="check" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{s.label}</b>
                <span className="s">{stepTitle(s.stepId)}</span>
              </div>
              <Pill kind="up">In review</Pill>
            </div>
            <div className="fchip">
              <Icon name="check" size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{s.fileName}</b>
                <span className="small">Received · {lead} is reviewing it</span>
              </div>
              <Btn cls="sm" ico="back" onClick={() => void undo(s)} title="Take the file back (within 10 minutes)">
                Undo
              </Btn>
            </div>
          </section>
        ))}
      </div>

      {nodes.length ? (
        <>
          <div className="dbar2">
            <Seg options={phaseOpts} value={f.phase} onChange={(v) => setF({ ...f, phase: v })} ariaLabel="Phase" />
            <Seg options={statOpts} value={f.stat} onChange={(v) => setF({ ...f, stat: v })} ariaLabel="Status" />
            <button type="button" className="crit" aria-pressed={f.rep} onClick={() => setF({ ...f, rep: !f.rep })}>
              <Icon name="hist" />
              Replaced
            </button>
            <span className="sp" />
            <label className="dfilter">
              <Icon name="search" />
              <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Find a document" aria-label="Find a document" />
            </label>
          </div>
          <div id="dsteps">
            {shownPhases.length ? (
              shownPhases.map((p) => {
                const all = live(p.steps.flatMap((s) => s.docs));
                const okN = all.filter((d) => docState(d) === 'ok').length;
                return (
                  <div key={p.id}>
                    <div className="dphase">
                      <span className="pn">{p.tag}</span>
                      <h3>{p.title}</h3>
                      <span className="small">{p.sub}</span>
                      <span className="bar2">
                        <i style={{ width: `${all.length ? (okN / all.length) * 100 : 0}%` }} />
                      </span>
                      <span className="c">
                        {okN}/{all.length} approved
                      </span>
                    </div>
                    <div className="dsteps">
                      {p.steps.map((s) => (
                        <StepCard key={s.id} s={s} shown={s.shown} open={open} />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="small" style={{ padding: '20px 0' }}>
                No documents match.
              </p>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

/* ================================================================ step card + rows */

function ringMini(frac: number) {
  const C = 2 * Math.PI * 8;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill="none" strokeWidth="3" style={{ stroke: 'var(--line)' }} />
      <circle cx="11" cy="11" r="8" fill="none" strokeWidth="3" strokeLinecap="round" style={{ stroke: 'var(--ok-green)' }} strokeDasharray={`${(C * frac).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 11 11)" />
    </svg>
  );
}

function StepCard({ s, shown, open }: { s: DocStepGroup; shown: DocNode[]; open: OpenRequest[] }) {
  const { openPop } = usePortal();
  const { focusUpload } = useDocActions();
  const l = live(s.docs);
  const done = l.filter((d) => docState(d) === 'ok').length;
  return (
    <section className="glass dstep fadein">
      <div className="dstep-h">
        <span className="stepno">{s.no ? String(s.no).padStart(2, '0') : <Icon name="folder" size={16} />}</span>
        <div style={{ minWidth: 0 }}>
          <b>{s.name}</b>
          <span className="s">
            {l.length} document{l.length === 1 ? '' : 's'}
          </span>
        </div>
        <span className="ring">
          {ringMini(l.length ? done / l.length : 0)}
          {done}/{l.length}
        </span>
      </div>
      {shown.map((d) => {
        const st = docState(d);
        const kind = fileKindOf(d.fileName, d.contentType);
        const needed = st === 'req' || st === 'over';
        const req = needed ? open.find((r) => r.id === d.requestId) : undefined;
        const meta = needed
          ? d.note
            ? `${d.noteBy ?? 'SBC'}: “${d.note}”`
            : `${d.from}${d.due ? ` · due ${fmt(d.due)}` : ''}`
          : st === 'rep'
            ? `Replaced · ${dateOf(d)}`
            : `${d.from} · ${dateOf(d)}`;
        return (
          <button
            key={d.id}
            type="button"
            className={'drow3' + (st === 'rep' ? ' rep' : '')}
            onClick={(e) => (needed ? focusUpload(req ? { requestId: req.id } : d.stepId ? { stepId: d.stepId } : undefined) : openPop(e.currentTarget, <DocCard id={d.id} />, { kind: 'doc' }))}
          >
            <span className={'fi ' + (needed ? 'NEED' + (st === 'over' ? ' over' : '') : kind)}>{needed ? '+' : kind}</span>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{d.label}</div>
              <div className="mt">{meta}</div>
            </div>
            <span className="st2">
              {d.stale ? <span className="chipw">Older than 2 months</span> : null}
              <span className={'pill ' + DST[st][0]}>{st === 'req' ? (d.due ? `Due ${fmt(d.due)}` : 'Needed') : st === 'over' ? 'Overdue' : docStateLabel(d)}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

/* ================================================================ upload card (one open request) */

function UploadCard({ r, accept, stepTitle, onSent }: { r: OpenRequest; accept: { exts: string[]; maxLabel: string }; stepTitle: string; onSent: (s: Sent) => void }) {
  const { toast } = usePortal();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<{ name: string; size: string; pct: number } | null>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  useEffect(() => () => xhr.current?.abort(), []);

  const accepted = (file: File | undefined) => {
    if (!file || busy) return;
    const bad = validateMilestoneUploadFile(file);
    if (bad) {
      toast(bad);
      return;
    }
    const body = new FormData();
    body.append('file', file);
    const x = new XMLHttpRequest();
    xhr.current = x;
    setBusy({ name: file.name, size: sizeLabel(file.size) ?? '', pct: 2 });
    x.open('POST', `/api/client/documents/requests/${encodeURIComponent(r.id)}/upload`);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable) setBusy((b) => (b ? { ...b, pct: Math.max(2, Math.min(98, Math.round((e.loaded / e.total) * 100))) } : b));
    };
    x.onload = () => {
      xhr.current = null;
      let json: { fileId?: string; error?: string } = {};
      try {
        json = JSON.parse(x.responseText || '{}') as typeof json;
      } catch {
        /* no body */
      }
      if (x.status >= 200 && x.status < 300 && json.fileId) {
        setBusy((b) => (b ? { ...b, pct: 100 } : b));
        onSent({ requestId: r.id, fileId: json.fileId, label: r.label, stepId: r.stepId, fileName: file.name });
      } else {
        setBusy(null);
        toast(json.error ?? 'Upload failed');
      }
    };
    x.onerror = () => {
      xhr.current = null;
      setBusy(null);
      toast('Upload failed');
    };
    x.send(body);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    accepted(e.dataTransfer.files?.[0]);
  };
  const over = r.overdue;
  const chips = specChips(accept, r);
  return (
    <section className={'glass upcard fadein' + (over ? ' over' : '')} id={uploadCardId(r.id)} data-step={r.stepId}>
      <div className="up-h">
        <span className="up-ic">
          <Icon name={over ? 'alert' : 'up'} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{r.label}</b>
          <span className="s">
            {stepTitle}
            {r.askedBy ? ` · asked by ${r.askedBy}` : ''}
          </span>
        </div>
        <span className={'pill ' + (over ? 'over' : 'due')}>{over && r.due ? `Overdue · was due ${fmt(r.due)}` : r.due ? `Due ${fmt(r.due)}` : r.reupload ? 'New file needed' : 'Needed'}</span>
      </div>
      <div className="spec">
        {chips.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      {r.note ? (
        <div className="banner due" style={{ marginTop: 0, padding: '10px 12px' }}>
          <Icon name="chat" />
          <div>
            <b>{r.noteBy ?? 'SBC'}</b>
            <span>“{r.note}”</span>
          </div>
        </div>
      ) : null}
      {busy ? (
        <div className="fchip">
          <span className={'fi ' + fileKindOf(busy.name)} style={{ width: 30, height: 34, borderRadius: 6, display: 'grid', placeItems: 'end center', paddingBottom: 4, font: '800 8px var(--f-disp)', color: '#fff', background: fileKindOf(busy.name) === 'JPG' ? '#0e9473' : fileKindOf(busy.name) === 'DOCX' ? '#2b6cd4' : '#d64545' }}>
            {fileKindOf(busy.name)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{busy.name}</b>
            <span className="small">
              {busy.size} · {busy.pct < 100 ? `uploading ${busy.pct}%` : 'received'}
            </span>
            <div className="pg" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={busy.pct}>
              <i style={{ width: `${busy.pct}%` }} />
            </div>
          </div>
        </div>
      ) : (
        <label
          className={'dz' + (drag ? ' drag' : '')}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept={accept.exts.map((e) => `.${e}`).join(',')}
            aria-label={`Upload ${r.label}`}
            onChange={(e) => {
              accepted(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <span className="di">
            <Icon name="up" />
          </span>
          <div>
            <b>Drop the file here or browse</b>
            <span>
              {chips[0]} · {chips[chips.length - 1]}
            </span>
          </div>
        </label>
      )}
    </section>
  );
}

/* ================================================================ document card (popover) */

/** The small card for one document; reads the live list so it refreshes with the data. */
export function DocCard({ id }: { id: string }) {
  const { openModal, closePop, toast } = usePortal();
  const { focusUpload } = useDocActions();
  const q = useClientDocuments();
  const { model } = usePortalIncorporation();
  const nodes = q.data?.nodes ?? [];
  const d = nodes.find((n) => n.id === id);
  if (!d) return <PopHead title="Document" sub="This document is no longer on record." />;
  const st = docState(d);
  const kind = fileKindOf(d.fileName, d.contentType);
  const s = d.stepId ? model.byId[d.stepId] : undefined;
  const vers = earlierVersions(d, nodes);
  const re = reuploadRequest(d, q.data?.openRequests ?? []);
  return (
    <div>
      <PopHead title={d.label} sub={s ? `Step ${s.n} · ${s.title}` : 'Other documents'} />
      <div className="thumb pvthumb">
        {[55, 92, 86, 96, 70, 88, 60].map((w, i) => (
          <i key={i} style={i ? { width: `${w}%` } : undefined} />
        ))}
        <span className={'ftype ' + kind}>{kind}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={'pill ' + DST[st][0]}>{docStateLabel(d)}</span>
        {d.stale ? <span className="chipw">Older than 2 months</span> : null}
        {d.note ? <span className="chipw">{d.noteBy ?? 'SBC'} asked for a new file</span> : null}
      </div>
      <dl className="meta" style={{ marginTop: 8 }}>
        <div>
          <dt>From</dt>
          <dd>{d.from}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{dateOf(d)}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd className="mono" style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>
            {d.fileName}
          </dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{sizeLabel(d.sizeBytes) ?? '—'}</dd>
        </div>
      </dl>
      {vers.length ? (
        <div className="vers">
          <span className="eyebrow">Earlier versions</span>
          {vers.map((v) => (
            <div key={v.id}>
              <span>{v.fileName !== '—' ? v.fileName : v.label}</span>
              <span>{dateOf(v)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="acts-row" style={{ flexWrap: 'wrap' }}>
        {d.ref ? (
          <>
            <Btn cls="pri sm" ico="dl" onClick={() => download(fileUrl(d.ref!, true), d.fileName)}>
              Download
            </Btn>
            <Btn cls="sm" ico="eye" onClick={() => openModal(<DocPreview id={d.id} />, { label: 'Document preview' })}>
              Preview
            </Btn>
          </>
        ) : null}
        {re ? (
          <Btn
            cls="sm"
            ico="up"
            onClick={() => {
              closePop();
              focusUpload({ requestId: re.id });
            }}
          >
            Replace
          </Btn>
        ) : null}
        <span className="sp" />
        {d.portal ? <GoArrow label={`Verify on ${d.portal.label}`} href={d.portal.url} onClick={() => toast(`Opening ${d.portal!.label}`)} /> : null}
      </div>
    </div>
  );
}

/* ================================================================ preview modal (#docm) */

export function DocPreview({ id }: { id: string }) {
  const q = useClientDocuments();
  const { model } = usePortalIncorporation();
  const d = (q.data?.nodes ?? []).find((n) => n.id === id);
  const ref = d?.ref;
  /* fetch the bytes first: a missing object becomes a plain message, a present one a blob URL for the frame */
  const [file, setFile] = useState<{ state: 'loading' } | { state: 'error'; msg: string } | { state: 'ready'; url: string; size: number }>({ state: 'loading' });
  useEffect(() => {
    if (!ref) return;
    let url = '';
    const ac = new AbortController();
    setFile({ state: 'loading' });
    fetch(fileUrl(ref), { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error === 'not_found' ? 'The file is not in storage any more. Ask SBC to upload it again.' : body.error ?? 'This file could not be opened');
        }
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setFile({ state: 'ready', url, size: blob.size });
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        setFile({ state: 'error', msg: e instanceof Error ? e.message : 'This file could not be opened' });
      });
    return () => {
      ac.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [ref]);
  if (!d || !ref) {
    return (
      <ModalBox
        className="docmodal"
        title="Document preview"
        foot={
          <button type="button" className="btn pri" data-close>
            Close
          </button>
        }
      >
        <p className="lede">This document is no longer on record.</p>
      </ModalBox>
    );
  }
  const mode = previewModeOf(d.fileName, d.contentType);
  const kind = fileKindOf(d.fileName, d.contentType);
  const s = d.stepId ? model.byId[d.stepId] : undefined;
  const src = fileUrl(ref);
  const blobUrl = file.state === 'ready' ? file.url : null;
  return (
    <div className="modal docmodal" role="dialog" aria-modal="true" aria-label="Document preview">
      <div className="docm-h">
        <span className={'ftype ' + kind}>{kind}</span>
        <h3 style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{d.label}</h3>
        <span className={'pill ' + DST[docState(d)][0]}>{docStateLabel(d)}</span>
        <button type="button" className="ib x" aria-label="Close" data-close>
          <Icon name="x" />
        </button>
      </div>
      <div className="small" style={{ marginBottom: 12 }}>
        {s ? `Step ${s.n} · ${s.title}` : 'Other documents'} · {d.from} · {dateOf(d)}
        {sizeLabel(file.state === 'ready' ? file.size : d.sizeBytes) ? ` · ${sizeLabel(file.state === 'ready' ? file.size : d.sizeBytes)}` : ''}
      </div>
      <div className="docm-body">
        {file.state === 'loading' ? (
          <div className="docm-none">
            <span className="small">Opening…</span>
          </div>
        ) : file.state === 'error' ? (
          <div className="docm-none">
            <Icon name="alert" size={28} />
            <b>{file.msg}</b>
          </div>
        ) : mode === 'pdf' && blobUrl ? (
          <iframe className="docm-frame" src={`${blobUrl}#toolbar=0&navpanes=0&view=FitH`} title={d.fileName} />
        ) : mode === 'image' && blobUrl ? (
          <img className="docm-img" src={blobUrl} alt={d.label} />
        ) : (
          <div className="docm-none">
            <span className={'fi ' + kind}>{kind}</span>
            <b>No preview for this file type</b>
            <span className="small">Download it to open it on your computer.</span>
          </div>
        )}
      </div>
      <div className="mfoot">
        <button type="button" className="btn" data-close>
          Close
        </button>
        {file.state !== 'error' ? (
          <a className="btn" href={src} target="_blank" rel="noopener noreferrer">
            <Icon name="ext" />
            Open in a new tab
          </a>
        ) : null}
        <Btn cls="pri" ico="dl" onClick={() => download(fileUrl(ref, true), d.fileName)} disabled={file.state === 'error'}>
          Download
        </Btn>
      </div>
    </div>
  );
}
