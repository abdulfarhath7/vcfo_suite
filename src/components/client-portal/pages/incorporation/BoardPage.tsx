'use client';

/**
 * BOARD RESOLUTION — `/app/client/board-resolution` (VCFO Spectrum, prototype
 * src/screens/client/BoardResolutionScreen.tsx): a plain page head with links to steps 2
 * and 3, the Drafted → Released → Signed → Received ST5 track, the preview card (zoom
 * 60–160 %, full screen = shared document viewer) and the Files card (Word draft, signed
 * copy, Replace signed copy drop zone). Real data: the board-resolution repository
 * (`GET /api/engagements/:id/board-resolution`, download / download-signed /
 * upload-signed routes) and `GET /api/client/incorporation` for names.
 */
import { CircleHelp, Download, Eye, Maximize2, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist/checklist-responses';
import { buildBoardResolutionMergeFields, type BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import {
  BOARD_RESOLUTION_DOCX_FILENAME,
  uploadSignedBoardResolution,
  validateSignedBoardResolutionFile,
} from '@/lib/board-resolution/board-resolution-storage';
import { fetchBoardResolutionInDb } from '@/lib/projects/engagements-db';
import { useRealtimeBoardResolution } from '@/hooks/use-realtime-board-resolution';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { usePortal, usePortalCrumbs } from '../../PortalProvider';
import { useDocViewer } from '../documents/DocViewer';
import { triggerDownload } from '../documents/file-types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { StepMark } from '@/components/ui/step-track';
import { FileBadge } from '@/components/ui/file-badge';
import { SkeletonRows } from '@/components/ui/empty-state';
import { toastSaved } from '@/components/ui/toast-saved';
import { IncFrame, fmt, istDay } from './ui';
import { INC_EXTRAS_KEY, firstName, signedUrlFor, stepHrefOf, useIncData } from './data';
import { Col, Cols, Dot, DropZone, Empty, Island, ListRow, PageHead, SCard, type PageHeadLink } from './spectrum';

/** A merge value still holding its template placeholder ("[Designation]") is not known yet. */
function known(v: string | undefined): string {
  const t = (v ?? '').trim();
  return t && !/^\[.*\]$/.test(t) && !/^_+$/.test(t) ? t : '';
}

/**
 * C-247, C-248: where the certified copy is signed and stamped (prototype BoardResolutionScreen
 * signature block and CompanyStamp). The names come from the Part A answers that fill the Word
 * draft (authorised person, designation, parent company, place). The line and the stamp ring
 * stay empty: the real signature and stamp are on the signed copy the client uploads.
 */
function SignOff({ fields, signedOn }: { fields?: ReturnType<typeof buildBoardResolutionMergeFields>; signedOn?: string }) {
  const parent = known(fields?.PARENT_ENTITY_NAME);
  const signer = known(fields?.SIGNATORY_NAME);
  const role = known(fields?.SIGNATORY_DESIGNATION);
  const place = known(fields?.CERTIFICATION_PLACE);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line-soft px-4 py-4 md:px-5" aria-label="Signature and stamp">
      <div className="min-w-[180px]">
        <div className="text-[12px] text-ink-muted">{parent ? `For ${parent}` : 'For the parent company'}</div>
        <div className="mt-8 w-[200px] max-w-full border-b border-ink-2" role="img" aria-label={signedOn ? 'Signed on the uploaded copy' : 'Not signed yet'} />
        <div className={cn('mt-1.5 text-[13px] font-medium', signer ? 'text-ink' : 'text-ink-faint')}>{signer || '-'}</div>
        <div className="text-[12px] text-ink-muted">{[role || 'Authorised person', parent].filter(Boolean).join(', ')}</div>
      </div>
      <div className="flex items-end gap-5">
        <span
          className="grid h-[74px] w-[74px] flex-none -rotate-12 place-items-center rounded-full border-2 border-dashed border-line-strong text-center"
          role="img"
          aria-label={parent ? `Company stamp area · ${parent}` : 'Company stamp area'}
        >
          <span className="grid h-[62px] w-[62px] place-items-center rounded-full border border-dashed border-line px-1.5 font-serif text-[9px] font-bold uppercase leading-tight text-ink-faint">
            <span className="line-clamp-3 break-words">{parent || 'Company stamp'}</span>
          </span>
        </span>
        <div className="text-right text-[12px] text-ink-muted">
          <div>Place: {place || '-'}</div>
          <div>Date: {signedOn ? fmt(signedOn) : '-'}</div>
        </div>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const d = useIncData();
  const { go, toast, openChat } = usePortal();
  usePortalCrumbs(['Incorporation', 'Board resolution']);
  const qc = useQueryClient();
  const viewer = useDocViewer();
  const { engagements, user, getStateForEngagement } = useApp();
  const engagement = useMemo(() => engagements.find((e) => e.id === d.engagementId), [engagements, d.engagementId]);
  const [doc, setDoc] = useState<BoardResolutionDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!d.engagementId) return;
    try {
      setDoc(await fetchBoardResolutionInDb(d.engagementId));
    } catch {
      /* shown as "not available yet" */
    } finally {
      setLoaded(true);
    }
  }, [d.engagementId]);
  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeBoardResolution({ appEngagementId: d.engagementId, onRemoteChange: () => void load() });
  void user;

  const mergeFields = useMemo(() => {
    const pre1 = checklist.find((c) => c.id === 'pre-1');
    if (!engagement || !pre1) return undefined;
    return buildBoardResolutionMergeFields({ engagement, pre1: extractItemResponses(pre1, getStateForEngagement(engagement)['pre-1']) });
  }, [engagement, getStateForEngagement]);

  const s2 = d.model.byId['pre-2'];
  const s3 = d.model.byId['pre-3'];
  const ex = d.extras?.boardResolution ?? null;
  const visible = doc?.status === 'finalized' && Boolean(doc.storagePath?.trim());
  const downloadHref = d.engagementId
    ? `/api/engagements/${d.engagementId}/board-resolution/download${doc?.updatedAt ? `?v=${encodeURIComponent(doc.updatedAt)}` : ''}`
    : '';
  const signedHref =
    d.engagementId && doc?.signedStoragePath
      ? `/api/engagements/${d.engagementId}/board-resolution/download-signed?v=${encodeURIComponent(doc.signedUploadedAt ?? doc.signedStoragePath)}`
      : '';
  // Steps 2–3 done but no finalized board-resolution file on record (older
  // engagements): the page still shows the tracker and the signed copy from
  // step 3, never "not ready yet" (IN-03).
  const s3Path = useMemo(() => {
    if (!s3) return '';
    return String(extractItemResponses(s3.item, s3.slice).signedBoardResolutionUrl ?? '').trim();
  }, [s3]);
  const showBody = visible || s2?.kind === 'done';
  const drafted = istDay(doc?.draftedAt);
  const released = istDay(doc?.finalizedAt) ?? (s2?.kind === 'done' ? s2.doneOn : undefined);
  const signed = istDay(doc?.signedUploadedAt) ?? istDay(s3?.slice?.clientSubmittedAt) ?? (s3Path && s3?.kind === 'done' ? s3.doneOn : undefined);
  const received = istDay(ex?.receivedAt) ?? (s3?.kind === 'done' ? s3.doneOn : undefined);
  const signedName = (doc?.signedStoragePath || s3Path).split('/').pop()?.replace(/^\d+-/, '') || 'signed copy';
  const signedUrl = signedHref ? async () => signedHref : s3Path ? () => signedUrlFor(s3Path) : null;

  const replace = async (file: File) => {
    if (!d.engagementId) return;
    const bad = validateSignedBoardResolutionFile(file);
    if (bad) {
      toast(bad);
      return;
    }
    setBusy(true);
    try {
      const body = await uploadSignedBoardResolution(d.engagementId, file);
      setDoc((p) => (p ? { ...p, signedUploadedAt: body.signedUploadedAt ?? p.signedUploadedAt, signedStoragePath: body.signedStoragePath ?? p.signedStoragePath } : p));
      void qc.invalidateQueries({ queryKey: INC_EXTRAS_KEY });
      // M-28 (A1): an upload with no Undo shows the white toast with the green tick.
      toastSaved('Signed copy uploaded', { kind: 'uploaded', sub: `${firstName(d.leadName) || 'Your team'} will check it.` });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const openFull = () => {
    if (!visible) {
      if (signedUrl) viewer.open([{ id: 'br-signed', name: signedName, url: signedUrl, meta: 'Board resolution · signed copy' }], 0);
      return;
    }
    if (!downloadHref) return;
    const docs = [{ id: 'br-draft', name: BOARD_RESOLUTION_DOCX_FILENAME, url: async () => downloadHref, meta: 'Board resolution · draft', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }];
    if (signedHref) docs.push({ id: 'br-signed', name: signedName, url: async () => signedHref, meta: 'Board resolution · signed copy', contentType: '' });
    viewer.open(docs, 0);
  };

  const stages: Array<[string, string | undefined, boolean]> = [
    ['Drafted', drafted ? `SBC · ${fmt(drafted)}` : 'SBC', Boolean(drafted || visible || released)],
    ['Released', released ? fmt(released) : undefined, Boolean(released)],
    ['Signed', signed ? `${d.short} · ${fmt(signed)}` : d.short, Boolean(signed)],
  ];

  const answer = {
    title: 'Board resolution',
    text: `${d.short}’s parent board authorises the India subsidiary. SBC drafts it, a director signs it, and ${d.short} uploads the signed copy.`,
    why: 'The name application in step 4 cannot be filed without it.',
    source: 'Companies Act 2013 · SPICe+ Part A',
    href: '/app/client/board-resolution',
  };

  const stepLinks: PageHeadLink[] = [s2, s3].filter((x): x is NonNullable<typeof x> => Boolean(x)).map((x) => ({ href: stepHrefOf(x), label: `${x.n} · ${x.title}`, dir: 'next' as const }));
  const headChip = received ? <Chip tone="ok">Done</Chip> : signed ? <Chip tone="prog">In progress</Chip> : visible ? <Chip tone="teal">Waiting</Chip> : null;
  const track: Array<{ label: string; sub?: string; done: boolean }> = [
    ...stages.map(([label, sub, done]) => ({ label, sub, done })),
    {
      label: 'Received by SBC',
      sub: received ? `${ex?.receivedByName ? `${firstName(ex.receivedByName)} · ` : ''}${fmt(received)}` : undefined,
      done: Boolean(received),
    },
  ];
  // The first open stage names who holds it now.
  const nowAt = track.findIndex((x) => !x.done);
  if (nowAt === 2) track[2]!.sub = `Waiting on ${d.short}`;
  if (nowAt === 3) track[3]!.sub = 'With SBC';
  const zoomBtn = 'h-[30px] w-[30px] min-w-0';
  const openSigned = () => signedUrl && viewer.open([{ id: 'br-signed', name: signedName, url: signedUrl, meta: 'Board resolution · signed copy' }], 0);
  const fileCount = (visible ? 1 : 0) + (signedUrl ? 1 : 0);

  return (
    <IncFrame pending={d.pending || !loaded} title="Board resolution · Incorporation · VCFO Suite">
      <div className="wrap">
        <Island className="grid grid-cols-1 gap-5">
          <PageHead
            label="Board resolution"
            title="Board resolution"
            chips={headChip}
            meta={
              <>
                <span>Phase 1 · Name Application · steps 2-3</span>
                {received ? (
                  <>
                    <Dot />
                    <span>Signed copy received · {fmt(received)}</span>
                  </>
                ) : signed ? (
                  <>
                    <Dot />
                    <span>Signed copy sent · {fmt(signed)}</span>
                  </>
                ) : null}
                {visible || signedUrl ? (
                  <>
                    <Dot />
                    <span>Certified true copy</span>
                  </>
                ) : null}
              </>
            }
            links={stepLinks}
            actions={
              <Button variant="quiet" size="sm" aria-label="What’s this? Board resolution" onClick={() => openChat('What’s this: Board resolution?', answer)}>
                <CircleHelp size={15} strokeWidth={1.6} aria-hidden />
                What’s this?
              </Button>
            }
          />

          {!loaded || d.pending ? (
            <>
              <SkeletonRows rows={1} />
              <Cols>
                <SkeletonRows rows={8} />
                <SkeletonRows rows={3} />
              </Cols>
            </>
          ) : !showBody ? (
            <Empty
              action={
                s2 ? (
                  <Button variant="secondary" onClick={() => go(stepHrefOf(s2))}>
                    Open step {s2.n}
                  </Button>
                ) : undefined
              }
            >
              The board resolution is not ready yet
            </Empty>
          ) : (
            <>
              {/* ST5 track (R-22): done stages are green squares with a tick, joined by a green line. */}
              <section className="rounded-md border-1.5 border-line bg-surface-raised px-4 py-4 md:px-5" aria-label="Progress of the board resolution">
                <ol className="m-0 flex list-none flex-col gap-3 p-0 md:flex-row md:items-start md:gap-0">
                  {track.map((st, i) => (
                    <li key={st.label} className="relative flex min-w-0 flex-1 items-center gap-2.5 md:flex-col md:items-start md:gap-2">
                      {i < track.length - 1 ? (
                        <span className={cn('absolute left-[30px] right-3 top-[10px] hidden h-[1.5px] md:block', st.done && track[i + 1]!.done ? 'bg-positive-mid' : 'bg-line')} aria-hidden />
                      ) : null}
                      <StepMark state={st.done ? 'done' : i === nowAt ? 'now' : 'next'} tone={i === nowAt && nowAt === 2 ? 'teal' : 'prog'} label={st.done ? 'Done' : i === nowAt ? 'Now' : 'Not started'} className="relative z-[1]" />
                      <span className="min-w-0">
                        <b className="block truncate text-[14px] font-medium text-ink">{st.label}</b>
                        {st.sub ? <span className="block truncate text-[12.5px] text-ink-muted">{st.sub}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <Cols>
                <Col>
                  <SCard
                    title="Preview"
                    meta={visible ? `certified true copy · ${Math.round(zoom * 100)}%` : 'signed copy'}
                    flush
                    right={
                      <>
                        {visible ? (
                          <>
                            <Button size="icon" variant="quiet" className={zoomBtn} aria-label="Zoom out" disabled={zoom <= 0.6} onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}>
                              <Minus size={16} strokeWidth={1.6} aria-hidden />
                            </Button>
                            <Button size="icon" variant="quiet" className={zoomBtn} aria-label="Zoom in" disabled={zoom >= 1.6} onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}>
                              <Plus size={16} strokeWidth={1.6} aria-hidden />
                            </Button>
                          </>
                        ) : null}
                        <Button size="icon" variant="quiet" className={zoomBtn} aria-label="Open full screen" onClick={openFull}>
                          <Maximize2 size={16} strokeWidth={1.6} aria-hidden />
                        </Button>
                      </>
                    }
                  >
                    {!visible ? (
                      <Empty
                        action={
                          signedUrl ? (
                            <Button variant="secondary" onClick={openSigned}>
                              Open the signed copy
                            </Button>
                          ) : undefined
                        }
                      >
                        {signedUrl ? 'The Word draft is not on file. The signed copy from step 3 is.' : 'The board resolution file is not on file yet'}
                      </Empty>
                    ) : (
                      <div className="pvw">
                        <div className="paper live" data-paper="" style={{ transform: `scale(${zoom})` }}>
                          <div className="cp-tw">
                            {d.engagementId ? (
                              <BoardResolutionDocPreview
                                engagementId={d.engagementId}
                                downloadUrl={downloadHref}
                                refreshKey={`${doc?.storagePath ?? ''}:${doc?.updatedAt ?? ''}`}
                                mergeFields={mergeFields}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                    {visible ? <SignOff fields={mergeFields} signedOn={signed} /> : null}
                  </SCard>
                </Col>
                <Col>
                  <SCard title="Files" meta={`${fileCount} file${fileCount === 1 ? '' : 's'}`} flush>
                    {visible ? (
                      <ListRow>
                        <FileBadge type="DOCX" />
                        <span className="min-w-0 flex-1" title={BOARD_RESOLUTION_DOCX_FILENAME}>
                          <b className="block truncate font-medium text-ink">Draft · Word</b>
                          <span className="block truncate text-[12.5px] text-ink-muted">
                            <span className="text-positive">Released</span> · {BOARD_RESOLUTION_DOCX_FILENAME} · SBC{released ? ` · ${fmt(released)}` : ''}
                          </span>
                        </span>
                        <Button size="icon" variant="quiet" className={zoomBtn} aria-label="Preview Draft · Word" onClick={openFull}>
                          <Eye size={16} strokeWidth={1.6} aria-hidden />
                        </Button>
                        <Button
                          size="icon"
                          variant="quiet"
                          className={zoomBtn}
                          aria-label={`Download ${BOARD_RESOLUTION_DOCX_FILENAME}`}
                          onClick={() => {
                            triggerDownload(downloadHref, BOARD_RESOLUTION_DOCX_FILENAME);
                            toast(`Download started · ${BOARD_RESOLUTION_DOCX_FILENAME}`);
                          }}
                        >
                          <Download size={16} strokeWidth={1.6} aria-hidden />
                        </Button>
                      </ListRow>
                    ) : null}
                    {signedUrl ? (
                      <ListRow>
                        <FileBadge type={/\.docx?$/i.test(signedName) ? 'DOCX' : 'PDF'} />
                        <span className="min-w-0 flex-1" title={signedName}>
                          <b className="block truncate font-medium text-ink">Signed copy</b>
                          <span className="block truncate text-[12.5px] text-ink-muted">
                            <span className="text-positive">{received ? 'Received' : 'Sent'}</span> · {signedName} · {ex?.signedUploadedByName ? firstName(ex.signedUploadedByName) : d.short}
                            {signed ? ` · ${fmt(signed)}` : ''}
                          </span>
                        </span>
                        <Button size="icon" variant="quiet" className={zoomBtn} aria-label="Preview Signed copy" onClick={openSigned}>
                          <Eye size={16} strokeWidth={1.6} aria-hidden />
                        </Button>
                        <Button
                          size="icon"
                          variant="quiet"
                          className={zoomBtn}
                          aria-label={`Download ${signedName}`}
                          onClick={async () => {
                            try {
                              triggerDownload(await signedUrl(), signedName);
                              toast(`Download started · ${signedName}`);
                            } catch (e) {
                              toast(e instanceof Error ? e.message : 'Could not download the file');
                            }
                          }}
                        >
                          <Download size={16} strokeWidth={1.6} aria-hidden />
                        </Button>
                      </ListRow>
                    ) : null}
                    <div className="border-t border-line-soft px-4 py-3 first:border-t-0 md:px-5">
                      <DropZone
                        label={signedUrl ? 'Replace signed copy' : 'Upload signed copy'}
                        hint="PDF · DOCX"
                        tone="accent"
                        busy={busy}
                        browseText="Drop a PDF or"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onFile={(f) => void replace(f)}
                      />
                    </div>
                  </SCard>
                </Col>
              </Cols>
            </>
          )}
        </Island>
      </div>
      {viewer.node}
    </IncFrame>
  );
}
