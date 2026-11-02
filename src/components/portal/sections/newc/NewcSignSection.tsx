'use client';

/**
 * New-client Declarations to sign (prototype #nsec-sign + a58b_newc.js
 * renderNewcSign / signCard): the board resolution (steps 2–3, the real board
 * stage and approval inside `<StepWork>`), then one card per signer — each
 * proposed director, and the company documents — listing the incorporation
 * drafts SBC generated on step pre-7 and shared with the client.
 *
 * Per draft: download it (the client only ever gets rows SBC shared — the
 * download route enforces it), upload the signed copy through the real path
 * when SBC has asked for it (a file request on the draft's signed field:
 * milestone-documents → /api/client/steps/:id/files), and its status. Papers
 * SBC asked to be signed through a document request are listed last, with
 * their own upload route. Nothing is invented: before SBC shares the drafts the
 * section says so plainly.
 */
import { useMemo, useState } from 'react';
import { usePaletteItems, useNavBadge, usePortal, type PaletteItem } from '../../runtime';
import { fmt } from '../../dates';
import { useRefreshPortal } from '../../data';
import { Icon, Pill, SecHead, SecLoading } from '../../ui';
import { StepWork } from '../incorporation/StepWork';
import { firstName, openInTab, signedUrlFor } from '../incorporation/files';
import { BOARD_LABEL, type BoardState, type DeclDoc, type DeclSigner } from './model';
import { allDraftsHref, draftHref, uploadForNeed, uploadForRequest, useNewc } from './useNewc';
import '../../css/95-newc.css';

const BOARD_PILL: Record<BoardState, 'mut' | 'due' | 'up' | 'ok'> = { prep: 'mut', approve: 'due', sign: 'due', sent: 'up', done: 'ok' };
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*';

function docLine(d: DeclDoc): string {
  if (d.state === 'signed') return 'Signed copy received';
  if (d.state === 'sign') {
    if (d.request && !d.request.fulfilledAt) return `Sign and upload${d.request.dueDate ? ` by ${fmt(d.request.dueDate)}` : ''}`;
    return 'Download and sign in ink';
  }
  if (d.state === 'prep') return 'Drafted · SBC shares it once checked';
  return d.optional ? 'Only if it applies · not drafted yet' : 'Not drafted yet';
}

function SignerCard({ s, engId, extrasEngId }: { s: DeclSigner; engId: string; extrasEngId?: string }) {
  const { toast } = usePortal();
  const refresh = useRefreshPortal();
  const [busy, setBusy] = useState<string | null>(null);
  const shared = s.docs.filter((d) => d.shared);
  const signed = shared.filter((d) => d.state === 'signed').length;
  const upload = async (d: DeclDoc, file: File) => {
    if (!d.request || !extrasEngId) return;
    setBusy(d.rowKey);
    try {
      await uploadForRequest(engId, extrasEngId, d.request, file);
      refresh();
      toast(`Signed ${d.label} uploaded · ${firstName(d.request.requestedByName) || 'your team'} will check it`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className={'glass panel' + (s.key === 'company' ? ' nsg-sub' : '')}>
      <div className="ph" style={{ marginBottom: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="eyebrow">{s.sub}</div>
          <h3>{s.name}</h3>
        </div>
        {shared.length ? (
          <span className={'pill ' + (signed === shared.length ? 'ok' : 'due')}>
            {signed} / {shared.length} signed
          </span>
        ) : (
          <Pill kind="mut">Not shared yet</Pill>
        )}
      </div>
      {s.docs.map((d) => {
        const canUpload = d.shared && d.request && !d.request.fulfilledAt && d.state !== 'signed';
        return (
          <div key={d.rowKey} className={'pdoc' + (d.state === 'signed' ? ' sg' : '') + (d.shared || d.state === 'signed' ? '' : ' npend')}>
            <span className={'fi ' + (d.state === 'signed' ? 'PDF' : '')}>{d.state === 'signed' ? 'PDF' : 'DOCX'}</span>
            <div style={{ minWidth: 0 }}>
              <b>{d.label}</b>
              <span>{docLine(d)}</span>
            </div>
            <div className="pd-acts">
              {d.shared ? (
                <a className="ib" href={draftHref(engId, d.doc, d.audience)} download aria-label={`Download ${d.label}`} title={`Download ${d.label}`}>
                  <Icon name="dl" />
                </a>
              ) : null}
              {d.signedPath ? (
                <button type="button" className="ib" aria-label={`Open the signed ${d.label}`} title="Open the signed copy" onClick={() => openInTab(() => signedUrlFor(d.signedPath!), toast)}>
                  <Icon name="eye" />
                </button>
              ) : null}
              {d.state === 'signed' ? <span className="dck ok" title="Signed copy received"><Icon name="check" /></span> : null}
              {canUpload ? (
                <label className={'btn sm pri upl3' + (busy === d.rowKey ? ' nbusy' : '')}>
                  <Icon name="up" />
                  {busy === d.rowKey ? 'Uploading…' : 'Upload signed'}
                  <input
                    type="file"
                    accept={ACCEPT}
                    aria-label={`Upload the signed ${d.label}`}
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void upload(d, f);
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function NewcSignSection() {
  const { go, toast } = usePortal();
  const n = useNewc();
  const refresh = useRefreshPortal();
  const { decl, board, boardStep, signNeeds, engagement, extras, model } = n;
  const [showBoard, setShowBoard] = useState(false);
  const [busyNeed, setBusyNeed] = useState<string | null>(null);

  /* ---------- badge, search (board-resolution links belong to Incorporation) */
  useNavBadge('nsign', n.loading ? undefined : n.signCount);
  const palette = useMemo<PaletteItem[]>(
    () => [
      { id: 'nsign-board', label: 'Board resolution', kind: `Declarations · ${BOARD_LABEL[board]}`, sw: board === 'sign' || board === 'approve' ? 'var(--due)' : 'var(--ice)', go: () => go('nsign', { target: 'nsign-board' }) },
      ...decl.signers.flatMap((s) =>
        s.docs
          .filter((d) => d.shared)
          .map((d) => ({
            id: `nsign-${d.rowKey}`,
            label: `${d.label} · ${s.name}`,
            kind: d.state === 'signed' ? 'Declaration · signed' : 'Declaration · to sign',
            sw: d.state === 'signed' ? 'var(--ok-green)' : 'var(--due)',
            go: () => go('nsign'),
          })),
      ),
    ],
    [board, decl, go],
  );
  usePaletteItems('newc-sign', palette);

  if (n.loading || !engagement) return <SecLoading label="Loading your declarations…" />;

  const engId = engagement.id;
  const boardOpen = board === 'approve' || board === 'sign' || showBoard;
  const s3 = model.byId['pre-3'];
  const stage = n.stage;
  const count =
    stage === 'skipped'
      ? undefined
      : decl.shared
        ? `${decl.signed} of ${decl.shared} signed copies in`
        : stage === 'incorporated'
          ? 'Complete'
          : board === 'sign' || board === 'approve'
            ? 'Board resolution to sign'
            : 'Not ready yet';
  const dirDocs = [...new Set(decl.signers.filter((s) => s.key !== 'company').flatMap((s) => s.docs.filter((d) => !d.optional).map((d) => d.label)))];
  const coDocs = decl.signers.find((s) => s.key === 'company')?.docs.filter((d) => !d.optional).map((d) => d.label) ?? [];

  const answerNeed = async (id: string, title: string, file: File) => {
    setBusyNeed(id);
    try {
      await uploadForNeed(id, file);
      refresh();
      toast(`${title} uploaded · your team will check it`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusyNeed(null);
    }
  };

  return (
    <>
      <SecHead title="Declarations to sign" count={count}>
        {decl.shared ? (
          <a className="btn sm" href={allDraftsHref(engId)} download>
            <Icon name="dl" />
            Download all
          </a>
        ) : null}
      </SecHead>

      {stage === 'skipped' ? (
        <section className="glass panel nwait">
          <Icon name="check" />
          <div>
            <b>Nothing to sign here</b>
            <span className="small">SPICe+ incorporation is not part of your project with SBC, so there is no board resolution or incorporation declaration to sign.</span>
          </div>
        </section>
      ) : null}

      {/* the board resolution: drafted by SBC (pre-2), signed by the company (pre-3) */}
      {stage === 'skipped' ? null : (
      <section className="glass panel nbr" id="nsign-board">
        <div className="ph" style={{ marginBottom: boardOpen ? 12 : 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="eyebrow">Company · steps 2–3 of Part A</div>
            <h3>Board resolution</h3>
            {!boardOpen ? (
              <span className="small">
                {board === 'prep'
                  ? 'SBC drafts it from your Part A details and releases it here to sign.'
                  : board === 'done'
                    ? `Signed and received by SBC${s3?.doneOn ? ` on ${fmt(s3.doneOn)}` : ''}.`
                    : 'Your signed copy is with SBC for checking.'}
              </span>
            ) : null}
          </div>
          <Pill kind={BOARD_PILL[board]} icon={board === 'done' ? 'check' : board === 'prep' || board === 'sent' ? 'clock' : 'alert'}>
            {BOARD_LABEL[board]}
          </Pill>
          {board !== 'prep' && board !== 'approve' && board !== 'sign' ? (
            <button type="button" className="link" aria-expanded={showBoard} onClick={() => setShowBoard((v) => !v)}>
              {showBoard ? 'Hide' : 'Open'}
            </button>
          ) : null}
        </div>
        {boardOpen && board !== 'prep' ? <StepWork stepId={boardStep} /> : null}
      </section>
      )}

      {/* the incorporation declarations */}
      {stage === 'skipped' ? null : decl.shared === 0 && stage === 'incorporated' ? (
        <section className="glass panel nwait">
          <Icon name="check" />
          <div>
            <b>Your declarations are complete</b>
            <span className="small">Your company is incorporated. The directors’ declarations were part of SPICe+, so nothing here needs your signature now.</span>
          </div>
        </section>
      ) : decl.shared === 0 ? (
        <section className="glass panel nwait">
          <Icon name="lock" />
          <div>
            <b>SBC releases your declarations here once your master data is accepted</b>
            <span className="small">
              {`SBC prepares ${dirDocs.length ? dirDocs.join(', ') : 'DIR-2, DIR-8 and INC-9'} for each director${coDocs.length ? `, and the company’s ${coDocs.join(', ')}` : ', and the memorandum and articles for the company'}, filled from your details.`}
              {decl.generated ? ` ${decl.generated} drafted so far.` : ''}
            </span>
          </div>
        </section>
      ) : (
        <>
          <div className="banner info" style={{ margin: '0 0 14px' }}>
            <Icon name="doc" />
            <div>
              <b>Download, print, sign in ink, scan and upload</b>
              <span>Each director signs their own declarations, where the form says Signature, on every page. One scan per document (PDF or photo). Upload appears on a document once SBC asks for its signed copy.</span>
            </div>
          </div>
          <div className={'nsg' + (decl.signers.length > 2 ? ' three' : '')}>
            {decl.signers
              .filter((s) => s.docs.some((d) => d.generated))
              .map((s) => (
                <SignerCard key={s.key} s={s} engId={engId} extrasEngId={extras?.engagementId} />
              ))}
          </div>
        </>
      )}

      {signNeeds.length ? (
        <section className="glass panel" style={{ marginTop: 14 }}>
          <div className="ph" style={{ marginBottom: 8 }}>
            <h3>Also asked of you</h3>
            <span className="sec-count">{signNeeds.length}</span>
          </div>
          {signNeeds.map((r) => (
            <div key={r.id} className="pdoc">
              <span className="fi">DOC</span>
              <div style={{ minWidth: 0 }}>
                <b>{r.title}</b>
                <span>{[r.detail, r.requestedByName ? `asked by ${firstName(r.requestedByName)}` : '', r.dueDate ? `due ${fmt(r.dueDate)}` : ''].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="pd-acts">
                <label className={'btn sm pri upl3' + (busyNeed === r.id ? ' nbusy' : '')}>
                  <Icon name="up" />
                  {busyNeed === r.id ? 'Uploading…' : 'Upload signed'}
                  <input
                    type="file"
                    accept={ACCEPT}
                    aria-label={`Upload ${r.title}`}
                    disabled={busyNeed !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void answerNeed(r.id, r.title, f);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
