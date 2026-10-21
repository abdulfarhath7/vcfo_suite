'use client';

/**
 * BOARD RESOLUTION — `/app/client/board-resolution` (FINAL board.html,
 * `renderBoard`): navy hero, Drafted → Released → Signed → Received tracker,
 * preview card (zoom 60–160 %, full screen = shared document viewer), Files
 * card (Word draft, signed copy, Replace signed copy drop zone) and the
 * "What happens with it" bot. Real data: the board-resolution repository
 * (`GET /api/engagements/:id/board-resolution`, download / download-signed /
 * upload-signed routes) and `GET /api/client/incorporation` for names.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchBoardResolutionInDb } from '@/lib/engagements-db';
import { useRealtimeBoardResolution } from '@/hooks/use-realtime-board-resolution';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { usePortal, usePortalCrumbs } from '../../PortalProvider';
import { phaseHref } from '../../routes';
import { useDocViewer } from '../documents/DocViewer';
import { triggerDownload } from '../documents/file-types';
import { Bmini, BotSay, Ic, IncFrame, Si, fmt, istDay } from './ui';
import { INC_EXTRAS_KEY, firstName, signedUrlFor, stepHrefOf, useIncData } from './data';

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
  const fileRef = useRef<HTMLInputElement>(null);

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
      toast(`Signed copy uploaded · ${firstName(d.leadName) || 'your team'} will check it`);
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
  const curIdx = stages.findIndex((x) => !x[2]);
  const heroGlyph = received ? 'done' : signed ? 'with' : 'you';
  const heroTip = received ? `Done · received ${fmt(received)}` : signed ? `With SBC · signed copy sent ${fmt(signed)}` : `Waiting on ${d.short} · sign and upload`;

  const answer = {
    title: 'Board resolution',
    text: `${d.short}’s parent board authorises the India subsidiary. SBC drafts it, a director signs it, and ${d.short} uploads the signed copy.`,
    why: 'The name application in step 4 cannot be filed without it.',
    source: 'Companies Act 2013 · SPICe+ Part A',
    href: '/app/client/board-resolution',
  };

  return (
    <IncFrame pending={d.pending || !loaded} title="Board resolution · Incorporation · VCFO Suite">
      <div className="wrap">
        <section className="hero" aria-label="Board resolution">
          <div className="hrow">
            <div className="hl">
              <button type="button" className="hback" aria-label="Back to Phase 1 · Name Application" onClick={() => go(phaseHref(1))}>
                <Ic n="chevron-left" />
              </button>
              <div className="htx">
                <div className="eb">Phase 1 · Name Application · steps 2–3</div>
                <div className="ht">
                  <h1>Board resolution</h1>
                  <button
                    type="button"
                    className="wt"
                    aria-label="What’s this? Board resolution"
                    data-tt="What’s this? · ask VCFO"
                    data-notip=""
                    onClick={() => openChat('What’s this: Board resolution?', answer)}
                  >
                    <Bmini />
                    What’s this?
                  </button>
                </div>
                <div className="hm" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {received ? (
                    <span className="chip done">Signed copy received · {fmt(received)}</span>
                  ) : signed ? (
                    <span className="chip with">Signed copy sent · {fmt(signed)}</span>
                  ) : visible ? (
                    <span className="chip you">Waiting for the signed copy</span>
                  ) : null}
                  {visible || signedUrl ? (
                    <span className="chip" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}>
                      Certified true copy
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="hr">
              <div className="hnav">
                {[s2, s3].map((x) =>
                  x ? (
                    <a
                      key={x.id}
                      href={stepHrefOf(x)}
                      className="wbtn"
                      aria-label={`Step ${x.n} · ${x.title}`}
                      onClick={(e) => {
                        e.preventDefault();
                        go(stepHrefOf(x));
                      }}
                    >
                      <span>
                        {x.n} · {x.title}
                      </span>
                      <Ic n="chevron-right" />
                    </a>
                  ) : null,
                )}
              </div>
              <Si k={heroGlyph} tip={heroTip} cls="xl" />
            </div>
          </div>
        </section>

        {!showBody && loaded ? (
          <section className="card" style={{ padding: 18 }}>
            <BotSay
              text="The board resolution is not ready yet. SBC drafts it from your details in step 1 and releases it here to sign."
              btn={s2 ? `Open step ${s2.n}` : undefined}
              onBtn={s2 ? () => go(stepHrefOf(s2)) : undefined}
            />
          </section>
        ) : null}

        {showBody ? (
          <>
            <section className="card trk" aria-label="Progress of the board resolution">
              <div className="lc">
                {stages.map((x, i) => (
                  <span key={x[0]} style={{ display: 'contents' }}>
                    <div className={`stg ${x[2] ? 'ok' : 'todo'}`}>
                      <span className="o">{x[2] ? <Ic n="check" cls="" /> : null}</span>
                      <span className="lb">
                        <b>{x[0]}</b>
                        {x[1] ? <small>{x[1]}</small> : null}
                      </span>
                    </div>
                    <span className={`cn ${x[2] && (i + 1 >= stages.length ? Boolean(received) : stages[i + 1]![2]) ? 'ok' : x[2] ? 'ok' : 'dot'}`} aria-hidden="true" />
                  </span>
                ))}
                {received ? (
                  <div className="now ok" role="group" aria-label={`Received by SBC${ex?.receivedByName ? ` · ${firstName(ex.receivedByName)}` : ''} · ${fmt(received)}`}>
                    <span className="tile">
                      <Ic n="check" />
                    </span>
                    <span className="tx">
                      <span className="k">Received</span>
                      <b>Received by SBC</b>
                      <small>
                        {ex?.receivedByName ? `${firstName(ex.receivedByName)} · ` : ''}
                        {fmt(received)}
                      </small>
                    </span>
                  </div>
                ) : (
                  <div className="now" role="group" aria-label={curIdx === 2 ? `Waiting on ${d.short} · sign and upload` : 'With SBC · checking the signed copy'}>
                    {curIdx === 2 ? <span className="tag">Waiting on {d.short}</span> : null}
                    <span className="tile">
                      <Ic n={curIdx === 2 ? 'upload' : 'sun'} />
                    </span>
                    <span className="tx">
                      <span className="k">Now</span>
                      <b>{curIdx === 2 ? 'Sign and upload' : 'Received by SBC'}</b>
                      <small>{curIdx === 2 ? 'Print, sign on letterhead, upload' : 'SBC checks the signed copy'}</small>
                    </span>
                  </div>
                )}
              </div>
            </section>

            <div className="brg">
              <section className="card prv" aria-label="Preview">
                <div className="ch">
                  <h2 className="lbl">Preview</h2>
                  <span className="cnt">
                    {visible ? (
                      <>
                        certified true copy · <span id="zv">{Math.round(zoom * 100)}%</span>
                      </>
                    ) : (
                      'signed copy'
                    )}
                  </span>
                  <span className="sp" />
                  {visible ? (
                    <>
                  <button type="button" className="sq" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}>
                    <Ic n="minus" />
                  </button>
                  <button type="button" className="sq" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}>
                    <Ic n="plus" />
                  </button>
                    </>
                  ) : null}
                  <button type="button" className="sq" aria-label="Open full screen" onClick={openFull}>
                    <Ic n="maximize" />
                  </button>
                </div>
                {!visible ? (
                  <div style={{ padding: '4px 18px 18px' }}>
                    <BotSay
                      text={signedUrl ? 'The Word draft is not on file here. The signed copy from step 3 is.' : 'The board resolution file is not on file here yet. Ask SBC for a copy.'}
                      btn={signedUrl ? 'Open the signed copy' : undefined}
                      onBtn={signedUrl ? () => viewer.open([{ id: 'br-signed', name: signedName, url: signedUrl, meta: 'Board resolution · signed copy' }], 0) : undefined}
                    />
                  </div>
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
              </section>
              <div className="scol">
                <section className="card acc files" aria-label="Files">
                  <div className="ch">
                    <h2 className="lbl">Files</h2>
                    <span className="sp" />
                    <span className="cnt">{(visible ? 1 : 0) + (signedUrl ? 1 : 0)} file{(visible ? 1 : 0) + (signedUrl ? 1 : 0) === 1 ? '' : 's'}</span>
                  </div>
                  {visible ? (
                  <div className="file">
                    <span className="ft docx">DOCX</span>
                    <span className="tx">
                      <b>Draft · Word</b>
                      <small>
                        {BOARD_RESOLUTION_DOCX_FILENAME} · SBC{released ? ` · ${fmt(released)}` : ''}
                      </small>
                    </span>
                    <span className="acts">
                      <span className="chip done">Released</span>
                      <button type="button" className="sq" aria-label="Preview Draft · Word" onClick={openFull}>
                        <Ic n="eye" />
                      </button>
                      <button
                        type="button"
                        className="sq"
                        aria-label={`Download ${BOARD_RESOLUTION_DOCX_FILENAME}`}
                        onClick={() => {
                          triggerDownload(downloadHref, BOARD_RESOLUTION_DOCX_FILENAME);
                          toast(`Download started · ${BOARD_RESOLUTION_DOCX_FILENAME}`);
                        }}
                      >
                        <Ic n="download" />
                      </button>
                    </span>
                  </div>
                  ) : null}
                  {signedUrl ? (
                    <div className="file">
                      <span className="ft pdf">{/\.docx?$/i.test(signedName) ? 'DOCX' : 'PDF'}</span>
                      <span className="tx">
                        <b>Signed copy</b>
                        <small>
                          {signedName} · {ex?.signedUploadedByName ? firstName(ex.signedUploadedByName) : d.short}
                          {signed ? ` · ${fmt(signed)}` : ''}
                        </small>
                      </span>
                      <span className="acts">
                        <span className="chip done">{received ? 'Received' : 'Sent'}</span>
                        <button
                          type="button"
                          className="sq"
                          aria-label="Preview Signed copy"
                          onClick={() => viewer.open([{ id: 'br-signed', name: signedName, url: signedUrl, meta: 'Board resolution · signed copy' }], 0)}
                        >
                          <Ic n="eye" />
                        </button>
                        <button
                          type="button"
                          className="sq"
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
                          <Ic n="download" />
                        </button>
                      </span>
                    </div>
                  ) : null}
                  <div
                    className={`drop blue${busy ? ' busy' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('over');
                    }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('over')}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('over');
                      const f = e.dataTransfer.files?.[0];
                      if (f) void replace(f);
                    }}
                  >
                    <button type="button" className="ut" aria-label={signedUrl ? 'Replace the signed copy' : 'Upload the signed copy'} onClick={() => fileRef.current?.click()}>
                      <Ic n={signedUrl ? 'refresh-cw' : 'upload'} />
                    </button>
                    <span className="tx">
                      <b>{signedUrl ? 'Replace signed copy' : 'Upload signed copy'}</b>
                      <span>
                        {busy ? (
                          'Uploading…'
                        ) : (
                          <>
                            Drop a PDF or{' '}
                            <button type="button" onClick={() => fileRef.current?.click()}>
                              browse
                            </button>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="mono">PDF · DOCX</span>
                    <input
                      ref={fileRef}
                      className="vh"
                      type="file"
                      tabIndex={-1}
                      aria-label="Choose the signed board resolution"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void replace(f);
                      }}
                    />
                  </div>
                </section>
                <section className="card acc team" aria-label="What happens with it">
                  <div className="ch">
                    <h2 className="lbl">What happens with it</h2>
                  </div>
                  <BotSay
                    text={`${d.short}’s parent board authorises the India subsidiary. SBC drafts it, a director signs it, and it goes with the name application in step 4.`}
                    btn={s3 ? `Open step ${s3.n}` : undefined}
                    aria={s3 ? `Open step ${s3.n} · ${s3.title}` : undefined}
                    onBtn={s3 ? () => go(stepHrefOf(s3)) : undefined}
                  />
                </section>
              </div>
            </div>
          </>
        ) : null}
      </div>
      {viewer.node}
    </IncFrame>
  );
}
