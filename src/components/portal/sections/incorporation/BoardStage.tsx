'use client';

/**
 * The board-resolution (NOC) document stage (steps 2–3, intent 'board'): the
 * track with the real step states (Drafted → Released → Signed → Notarised →
 * Apostilled → Accepted for a foreign parent; four steps for an Indian parent),
 * the status words (released / signed copy sent / sent back with the reason /
 * accepted), the variant label and version, the Word draft and the signed copy,
 * the signed-copy upload / replace until SBC accepts it, and an inline preview
 * of the draft — in the portal's own look.
 *
 * Real data: `GET /api/engagements/:id/board-resolution/noc` (docs/ui-port/
 * BR-NOC-API.md; a client response never carries the staff block),
 * `GET /api/engagements/:id/board-resolution` (fetchBoardResolutionInDb), the
 * download / download-signed routes, `uploadSignedBoardResolution`
 * (upload-signed route) and `/api/client/incorporation` for names and dates.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist/checklist-responses';
import { buildBoardResolutionMergeFields, type BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import { BOARD_RESOLUTION_DOCX_FILENAME, uploadSignedBoardResolution, validateSignedBoardResolutionFile } from '@/lib/board-resolution/board-resolution-storage';
import { fetchBoardResolutionInDb } from '@/lib/projects/engagements-db';
import type { NocState } from '@/lib/noc/state';
import { useRealtimeBoardResolution } from '@/hooks/use-realtime-board-resolution';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { usePortal } from '../../runtime';
import { Btn, Icon, Pill } from '../../ui';
import { fmt, fmtStamp } from '../../dates';
import { PK, getJson, useIncorporationExtras, usePortalIncorporation, useRefreshPortal } from '../../data';
import { FileRow, fileKind } from './FileRow';
import { firstName, openInTab, signedUrlFor } from './files';
import { canUploadSigned, nocPhase, nocStageRows, nocStatus, nocVariantLabel, signedCopyChip } from './noc';

/** The NOC state query key; it starts with PK so `useRefreshPortal()` refetches it too. */
const nocKey = (engId: string) => [PK, 'board-resolution-noc', engId] as const;

export function BoardStage() {
  const { toast, shell, isLight } = usePortal();
  const { model, engagement } = usePortalIncorporation();
  const extras = useIncorporationExtras();
  const refresh = useRefreshPortal();
  const qc = useQueryClient();
  const { getStateForEngagement } = useApp();
  const engId = engagement?.id;
  const short = shell?.companyShort || 'Your company';
  const lead = shell?.team.find((t) => t.role === 'Project Lead')?.name;

  const [doc, setDoc] = useState<BoardResolutionDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    if (!engId) return;
    try {
      setDoc(await fetchBoardResolutionInDb(engId));
    } catch {
      /* shown as "not ready yet" */
    } finally {
      setLoaded(true);
    }
  }, [engId]);
  useEffect(() => {
    void load();
  }, [load]);

  const nocQ = useQuery({
    queryKey: nocKey(engId ?? ''),
    queryFn: async () => (await getJson<{ noc?: NocState }>(`/api/engagements/${encodeURIComponent(engId!)}/board-resolution/noc`))?.noc ?? null,
    enabled: Boolean(engId),
    staleTime: 30_000,
    retry: false,
  });
  const noc = nocQ.data ?? null;
  const reloadNoc = useCallback(() => {
    if (engId) void qc.invalidateQueries({ queryKey: nocKey(engId) });
  }, [qc, engId]);

  useRealtimeBoardResolution({
    appEngagementId: engId,
    onRemoteChange: () => {
      void load();
      reloadNoc();
    },
  });

  const mergeFields = useMemo(() => {
    const pre1 = checklist.find((c) => c.id === 'pre-1');
    if (!engagement || !pre1) return undefined;
    return buildBoardResolutionMergeFields({ engagement, pre1: extractItemResponses(pre1, getStateForEngagement(engagement)['pre-1']) });
  }, [engagement, getStateForEngagement]);

  const s2 = model.byId['pre-2'];
  const s3 = model.byId['pre-3'];
  const ex = extras.data?.boardResolution ?? null;
  const visible = doc?.status === 'finalized' && Boolean(doc.storagePath?.trim());
  const downloadHref = engId ? `/api/engagements/${engId}/board-resolution/download${doc?.updatedAt ? `?v=${encodeURIComponent(doc.updatedAt)}` : ''}` : '';
  const signedHref =
    engId && doc?.signedStoragePath ? `/api/engagements/${engId}/board-resolution/download-signed?v=${encodeURIComponent(doc.signedUploadedAt ?? doc.signedStoragePath)}` : '';
  const s3Path = useMemo(() => (s3 ? String(extractItemResponses(s3.item, s3.slice).signedBoardResolutionUrl ?? '').trim() : ''), [s3]);
  const day = (ts?: string | null) => (ts ? fmtStamp(ts) : undefined);

  // Fallback dates (the route has nothing yet): the board-resolution row, then steps 2 and 3.
  const fbReleased = day(doc?.finalizedAt) ?? (s2?.kind === 'done' && s2.doneOn ? fmt(s2.doneOn) : undefined);
  const fbSigned = day(doc?.signedUploadedAt) ?? day(s3?.slice?.clientSubmittedAt) ?? (s3Path && s3?.kind === 'done' && s3.doneOn ? fmt(s3.doneOn) : undefined);
  const fbAccepted = day(ex?.receivedAt) ?? (s3?.kind === 'done' && s3.doneOn ? fmt(s3.doneOn) : undefined);
  const rows = nocStageRows(
    noc,
    { drafted: day(doc?.draftedAt), released: fbReleased, signed: fbSigned, signedBy: ex?.signedUploadedByName, accepted: fbAccepted, acceptedBy: ex?.receivedByName, onFile: visible },
    { company: short, day, firstName },
  );
  const sentBack = noc?.sentBack ?? null;
  const phase = nocPhase(rows, Boolean(sentBack));
  const accepted = phase === 'accepted';
  const status = nocStatus(phase, rows, day(sentBack?.at));
  const signedDone = rows.some((r) => r.key === 'signed' && r.done);
  const releasedDone = rows.some((r) => r.key === 'released' && r.done);
  const answers = noc?.answers ?? {
    ownershipType: engagement?.ownershipType ?? null,
    companyType: engagement?.companyType ?? null,
    parentIndianRelationship: engagement?.parentIndianRelationship ?? null,
  };
  const variantLabel = nocVariantLabel(noc, answers);
  const showBody = visible || releasedDone || s2?.kind === 'done';
  const signedName = (doc?.signedStoragePath || s3Path).split('/').pop()?.replace(/^\d+-/, '') || 'Signed copy';
  const signedUrl: (() => Promise<string>) | null = signedHref ? async () => signedHref : s3Path ? () => signedUrlFor(s3Path) : null;
  const signedRow = rows.find((r) => r.key === 'signed');
  const signedChip = signedCopyChip(phase);

  const replace = async (file: File) => {
    if (!engId) return;
    const bad = validateSignedBoardResolutionFile(file);
    if (bad) {
      toast(bad);
      return;
    }
    setBusy(true);
    try {
      const body = await uploadSignedBoardResolution(engId, file);
      setDoc((p) => (p ? { ...p, signedUploadedAt: body.signedUploadedAt ?? p.signedUploadedAt, signedStoragePath: body.signedStoragePath ?? p.signedStoragePath } : p));
      refresh();
      reloadNoc();
      toast(`Signed copy uploaded · ${firstName(lead) || 'your team'} will check it`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded && engId) return <div className="sw-note">Loading the board resolution…</div>;

  return (
    <div className="sw-blk sw-board">
      <div className="sw-h">
        <span className="eyebrow">Board resolution (NOC)</span>
        <span className="sp" />
        {status ? (
          <Pill kind={status.kind} icon={status.icon}>
            {status.text}
          </Pill>
        ) : null}
      </div>
      <div className="sw-noc-var">
        <span className="small">{variantLabel}</span>
        {noc?.version ? <span className="pill mut sm">Version {noc.version}</span> : null}
      </div>
      {!showBody ? (
        <div className="banner info">
          <Icon name="clock" />
          <div>
            <b>Not ready yet</b>
            <span>SBC drafts the board resolution from your details in step 1 and releases it here to sign.</span>
          </div>
        </div>
      ) : (
        <>
          {sentBack ? (
            <div className="banner over sw-noc-back" role="status">
              <Icon name="alert" />
              <div>
                <b>
                  Sent back{sentBack.byName ? ` by ${firstName(sentBack.byName)}` : ''}
                  {day(sentBack.at) ? ` · ${day(sentBack.at)}` : ''}
                </b>
                <span>{sentBack.reason}</span>
                <span className="sw-noc-next">Fix it and upload the signed copy again below.</span>
              </div>
            </div>
          ) : null}
          <div className="needs" aria-label="Progress of the board resolution">
            {rows.map((r) => (
              <div key={r.key} className={'need' + (r.now ? ' sw-now' : '')} aria-pressed={r.done} aria-current={r.now ? 'step' : undefined}>
                <span className="bx">
                  <Icon name="check" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b className="sw-need-t">{r.label}</b>
                  <div className="small">{r.sub}</div>
                </div>
                {r.now ? <span className="pill mut sm sw-now-pill">Now</span> : null}
              </div>
            ))}
          </div>
          <div className="sw-files">
            {visible ? (
              <FileRow
                name="Draft · Word"
                meta={`${BOARD_RESOLUTION_DOCX_FILENAME} · SBC${fbReleased ? ` · ${fbReleased}` : ''}`}
                kind="DOCX"
                chip={<Pill kind="done">Released</Pill>}
                onDownload={() => {
                  openInTab(downloadHref);
                  toast(`Download started · ${BOARD_RESOLUTION_DOCX_FILENAME}`);
                }}
              />
            ) : null}
            {signedUrl ? (
              <FileRow
                name="Signed copy"
                meta={`${signedName}${signedDone && signedRow?.sub ? ` · ${signedRow.sub}` : ''}`}
                kind={fileKind(signedName)}
                chip={<Pill kind={signedChip.kind}>{signedChip.text}</Pill>}
                onOpen={() => openInTab(signedUrl, toast)}
              />
            ) : null}
            {!visible && !signedUrl ? <div className="sw-note">The board resolution file is not on file here yet. Ask SBC for a copy.</div> : null}
          </div>
          {(visible || signedUrl) && canUploadSigned(phase) ? (
            <label className={'drop' + (busy ? ' sw-busy' : '') + (signedUrl && phase !== 'sent_back' ? ' sent' : '')}>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Choose the signed board resolution"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void replace(f);
                }}
              />
              <b>{busy ? 'Uploading…' : signedUrl ? 'Replace the signed copy' : 'Upload the signed copy'}</b>
              <span>PDF or DOCX · signed on letterhead{noc?.foreignParent && !noc.notaryStepsOff ? ' · notarised and apostilled' : ''}</span>
            </label>
          ) : null}
          {accepted ? <div className="sw-note">SBC accepted the signed copy. It is filed in your documents.</div> : null}
          {visible && engId ? (
            <div style={{ marginTop: 12 }}>
              <Btn cls="sm" ico={preview ? 'x' : 'eye'} onClick={() => setPreview((p) => !p)}>
                {preview ? 'Hide the preview' : 'Preview the draft'}
              </Btn>
              {preview ? (
                <div className={'sw-tw sw-paper' + (isLight ? '' : ' dark')}>
                  <BoardResolutionDocPreview engagementId={engId} downloadUrl={downloadHref} refreshKey={`${doc?.storagePath ?? ''}:${doc?.updatedAt ?? ''}`} mergeFields={mergeFields} />
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
