'use client';

/**
 * The board-resolution document stage (steps 2–3, intent 'board'): the
 * Drafted → Released → Signed → Received tracker, the Word draft and the signed
 * copy, the signed-copy upload / replace, and an inline preview of the draft —
 * what the previous portal's BoardPage did, in the new look.
 *
 * Real data: `GET /api/engagements/:id/board-resolution` (fetchBoardResolutionInDb),
 * the download / download-signed routes, `uploadSignedBoardResolution`
 * (upload-signed route) and `/api/client/incorporation` for names and dates.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist/checklist-responses';
import { buildBoardResolutionMergeFields, type BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import { BOARD_RESOLUTION_DOCX_FILENAME, uploadSignedBoardResolution, validateSignedBoardResolutionFile } from '@/lib/board-resolution/board-resolution-storage';
import { fetchBoardResolutionInDb } from '@/lib/projects/engagements-db';
import { useRealtimeBoardResolution } from '@/hooks/use-realtime-board-resolution';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { usePortal } from '../../runtime';
import { Btn, Icon, Pill } from '../../ui';
import { fmt, fmtStamp } from '../../dates';
import { useIncorporationExtras, usePortalIncorporation, useRefreshPortal } from '../../data';
import { FileRow, fileKind } from './FileRow';
import { firstName, openInTab, signedUrlFor } from './files';

export function BoardStage() {
  const { toast, shell, isLight } = usePortal();
  const { model, engagement } = usePortalIncorporation();
  const extras = useIncorporationExtras();
  const refresh = useRefreshPortal();
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
  useRealtimeBoardResolution({ appEngagementId: engId, onRemoteChange: () => void load() });

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
  const showBody = visible || s2?.kind === 'done';
  const day = (ts?: string | null) => (ts ? fmtStamp(ts) : undefined);
  const drafted = day(doc?.draftedAt);
  const released = day(doc?.finalizedAt) ?? (s2?.kind === 'done' && s2.doneOn ? fmt(s2.doneOn) : undefined);
  const signed = day(doc?.signedUploadedAt) ?? day(s3?.slice?.clientSubmittedAt) ?? (s3Path && s3?.kind === 'done' && s3.doneOn ? fmt(s3.doneOn) : undefined);
  const received = day(ex?.receivedAt) ?? (s3?.kind === 'done' && s3.doneOn ? fmt(s3.doneOn) : undefined);
  const signedName = (doc?.signedStoragePath || s3Path).split('/').pop()?.replace(/^\d+-/, '') || 'Signed copy';
  const signedUrl: (() => Promise<string>) | null = signedHref ? async () => signedHref : s3Path ? () => signedUrlFor(s3Path) : null;

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
      toast(`Signed copy uploaded · ${firstName(lead) || 'your team'} will check it`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const stages: Array<[string, string, boolean]> = [
    ['Drafted', drafted ? `SBC · ${drafted}` : drafted || visible || released ? 'By SBC, from your details in step 1' : 'SBC drafts it from your details in step 1', Boolean(drafted || visible || released)],
    ['Released', released ? `Released to ${short} · ${released}` : 'SBC releases it here to sign', Boolean(released)],
    ['Signed', signed ? `${ex?.signedUploadedByName ? firstName(ex.signedUploadedByName) : short} · ${signed}` : received ? `Signed by ${short}` : 'Print on letterhead, a director signs, upload it', Boolean(signed || received)],
    ['Received', received ? `Received by SBC${ex?.receivedByName ? ` · ${firstName(ex.receivedByName)}` : ''} · ${received}` : 'SBC checks the signed copy', Boolean(received)],
  ];

  if (!loaded && engId) return <div className="sw-note">Loading the board resolution…</div>;

  return (
    <div className="sw-blk sw-board">
      <div className="sw-h">
        <span className="eyebrow">Board resolution</span>
        <span className="sp" />
        {received ? (
          <Pill kind="ok" icon="check">
            Received {received}
          </Pill>
        ) : signed ? (
          <Pill kind="up" icon="clock">
            Signed copy sent {signed}
          </Pill>
        ) : visible ? (
          <Pill kind="due" icon="clock">
            Waiting for the signed copy
          </Pill>
        ) : null}
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
          <div className="needs">
            {stages.map(([t, sub, ok]) => (
              <div key={t} className="need" aria-pressed={ok}>
                <span className="bx">
                  <Icon name="check" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b className="sw-need-t">{t}</b>
                  <div className="small">{sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="sw-files">
            {visible ? (
              <FileRow
                name="Draft · Word"
                meta={`${BOARD_RESOLUTION_DOCX_FILENAME} · SBC${released ? ` · ${released}` : ''}`}
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
                meta={`${signedName}${signed ? ` · ${signed}` : ''}`}
                kind={fileKind(signedName)}
                chip={<Pill kind="done">{received ? 'Received' : 'Sent'}</Pill>}
                onOpen={() => openInTab(signedUrl, toast)}
              />
            ) : null}
            {!visible && !signedUrl ? <div className="sw-note">The board resolution file is not on file here yet. Ask SBC for a copy.</div> : null}
          </div>
          {visible || signedUrl ? (
            <label className={'drop' + (busy ? ' sw-busy' : '') + (received ? ' sent' : '')}>
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
              <span>PDF or DOCX · signed on letterhead</span>
            </label>
          ) : null}
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
