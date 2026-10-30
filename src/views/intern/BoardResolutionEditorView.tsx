'use client';

'use client';


import { useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, Send, Undo2, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

import {

  AlertTriangle,

  Download,

} from 'lucide-react';


import { PageTransition } from '@/components/shell/PageTransition';

import { SEO } from '@/components/SEO';



import { Chip } from '@/components/ui/spectrum-chip';
import { StepLink, StepMark } from '@/components/ui/step-track';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { RecordTile } from '@/components/incorporation/RecordHead';
import { cn } from '@/lib/utils';


import {

  AlertDialog,

  AlertDialogAction,

  AlertDialogCancel,

  AlertDialogContent,

  AlertDialogDescription,

  AlertDialogFooter,

  AlertDialogHeader,

  AlertDialogTitle,

} from '@/components/ui/alert-dialog';















import { getItem } from '@/data/checklist';
import type { BoardResolutionMissingFieldRef } from '@/lib/api/board-resolution-errors';
import { docPackStepPath } from '@/lib/doc-pack/paths';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import {
  BoardResolutionEditorDocPanel,
  type BoardResolutionEditorProps,
} from '@/views/intern/BoardResolutionEditorDocPanel';
import { useNocState } from '@/views/intern/board-resolution-noc/useNocState';
import {
  NocReceiveCard,
  NocTemplateCard,
  NocTrackStrip,
  NocWhyCard,
} from '@/views/intern/board-resolution-noc/NocStaffCards';

/** "NIC code — Client Details, Business Description" */
function missingFieldRefText(ref: BoardResolutionMissingFieldRef): string {
  const where = [getItem(ref.stepId)?.title, ref.section].filter(Boolean).join(', ');
  return where ? `${ref.label} — ${where}` : ref.label;
}

/** "29 Oct" (R-29). */
function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace(/\bSept\b/, 'Sep');
}

type BrStage = { key: string; label: string; done: boolean };

/**
 * The five stages of a board resolution (prototype `BoardResolutionScreen` stepper), from the
 * stored document only: a Word file exists, the draft left the lead (with the manager or
 * finalized), it is finalized for the client, and the client uploaded the signed copy. The real
 * tool does not record a separate "sent to the client" moment: finalizing makes the file visible
 * on the client portal; "Sent to client" is the staff record of sending it for signing
 * (`sent_to_client_at`, S-573).
 */
function brStages(
  doc: BoardResolutionEditorProps['doc'],
  withManager: boolean,
  isFinalized: boolean,
  sentToClientAt: string | null,
): BrStage[] {
  const generated = Boolean(doc?.storagePath?.trim() || doc?.content?.trim());
  const signed = Boolean(doc?.signedStoragePath?.trim());
  return [
    { key: 'generated', label: 'Generated from Pre-1', done: generated },
    { key: 'draft', label: 'Draft · editing', done: withManager || isFinalized },
    { key: 'finalized', label: 'Finalized · client visible', done: isFinalized },
    { key: 'sent', label: 'Sent to client', done: isFinalized && (Boolean(sentToClientAt) || signed) },
    { key: 'signed', label: 'Signed copy uploaded', done: signed },
  ];
}

function BrStageList({ stages }: { stages: BrStage[] }) {
  const cur = stages.findIndex((x) => !x.done);
  return (
    <ol className="grid">
      {stages.map((x, i) => (
        <li
          key={x.key}
          className={cn('relative flex items-center gap-2.5 rounded-md px-2 py-2 text-[13.5px]', i === cur && 'bg-surface-sunken')}
        >
          <StepLink
            x={18}
            up={i > 0 && (stages[i - 1].done ? 'done' : 'todo')}
            down={i < stages.length - 1 && (x.done ? 'done' : 'todo')}
          />
          <StepMark
            state={x.done ? 'done' : i === cur ? 'now' : 'next'}
            size={20}
            label={x.done ? 'Done' : i === cur ? 'Current' : 'Not started'}
            className="relative z-[1]"
          />
          <span className={cn(x.done || i === cur ? 'text-ink' : 'text-ink-muted', i === cur && 'font-medium')}>{x.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function BoardResolutionEditorView(p: BoardResolutionEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    eng,
    isLead,
    staffShell,
    handleApprove,
    handleSendBack,
    handleUploadSigned,
    finalizeOpen,
    setFinalizeOpen,
    busy,
    internBoardResolutionPath,
    isFinalized,
    loading,
    hasPre1Data,
    pre1StepHref,
    generateErrorDisplay,
    generateError,
    doc,
    signedDownloadHref,
    previewStorageCorrupt,
    handleFinalize,
    withManager,
    sentBackNote,
    handleGenerate,
  } = p;
  const signed = Boolean(doc?.signedStoragePath?.trim());
  // R-52 (T1 to T6): the board resolution (NOC) state, reloaded when the document changes.
  const nocState = useNocState(eng.id, `${doc?.status ?? ''}:${doc?.updatedAt ?? ''}:${doc?.signedUploadedAt ?? ''}`);
  const noc = nocState.noc;
  const parentName = noc?.parentName || eng.parentEntityName?.trim() || '';
  const nocError = (message: string) => toastError('Could not save', message);
  const [makingAgain, setMakingAgain] = useState(false);
  const makeAgain = async () => {
    setMakingAgain(true);
    try {
      await handleGenerate();
      await nocState.reload();
    } finally {
      setMakingAgain(false);
    }
  };
  const signedInputRef = useRef<HTMLInputElement>(null);
  const [backOpen, setBackOpen] = useState(false);
  const [backNote, setBackNote] = useState('');
  const [sentOverride, setSentOverride] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sentToClientAt = sentOverride ?? doc?.sentToClientAt ?? null;

  /** "Send to client" (S-573): opens a mail to the client and records the send. */
  const sendToClient = async () => {
    const to = eng.clientEmail?.trim();
    if (to) {
      const subject = encodeURIComponent(`Board resolution for signing · ${eng.companyName}`);
      window.location.href = `mailto:${to}?subject=${subject}`;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/board-resolution/sent`, { method: 'POST' });
      const out = (await res.json().catch(() => ({}))) as { boardResolution?: { sentToClientAt?: string | null }; error?: string };
      if (!res.ok) throw new Error(out.error || 'Could not record the send');
      setSentOverride(out.boardResolution?.sentToClientAt ?? new Date().toISOString());
      toastSuccess('Sent to client', eng.companyName);
    } catch (err) {
      toastError('Could not send', errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  const stageWord = signed ? 'Signed' : isFinalized && sentToClientAt ? 'Sent' : isFinalized ? 'Finalized' : withManager ? 'With manager' : 'Draft';
  const stageTone = signed || isFinalized ? 'ok' : withManager ? 'teal' : 'warn';
  return (

    <PageTransition>

      <SEO

        title={`Board Resolution — ${eng.companyName}`}

        description="Draft and finalize the certified board resolution for the India subsidiary."

        path={pathname || internBoardResolutionPath(eng)}

      />

      {/* Plain head (prototype `BoardResolutionScreen`): the 44px client tile, the 28px title and
          the stage chip, then the client and the step code. No back link (R-09). */}
      <header className="mb-5 flex min-w-0 items-start gap-3">
        <RecordTile name={eng.companyName} identityId={eng.id} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Board resolution (NOC)</h1>
            <Chip tone={stageTone} fixed>
              {stageWord}
            </Chip>
          </div>
          {noc ? <p className="text-[14px] text-ink-2">{noc.variantLabel}</p> : null}
          <p className="text-[13.5px] text-ink-muted">
            {parentName ? `Passed by: Board of ${parentName} (the parent) · ` : ''}
            {eng.companyName} · Phase 1 · Steps 2–3 · <span className="font-mono text-[13px]">Pre-2</span>
          </p>
        </div>
      </header>

      {noc ? <NocTrackStrip noc={noc} nowLabel={signed && !noc.accepted ? 'With SBC' : undefined} /> : null}

      <div className={cn('grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start', noc && 'mt-5')}>
      <div className="min-w-0">

        {withManager && !isFinalized ? (
          <p role="status" className="mb-4 rounded-md border-1.5 border-brand-line bg-brand-soft px-3 py-2 text-[13.5px] text-ink">
            {isLead
              ? 'The board resolution is with your manager. You can edit it again if they send it back.'
              : 'The project lead sent this for approval.'}
          </p>
        ) : null}

        {sentBackNote && !withManager && !isFinalized ? (
          <p role="status" className="mb-4 rounded-md border-1.5 border-warning-mid bg-warning-soft px-3 py-2 text-[13.5px] text-ink">
            <span className="font-medium">{isLead ? 'Your manager sent this back:' : 'Sent back to the lead:'}</span> {sentBackNote}
          </p>
        ) : null}

        {!hasPre1Data && !loading && (

          <p className="mb-4 rounded-md border-1.5 border-warning-mid bg-warning-soft px-3 py-2 text-[13.5px] text-warning">

            Submit Client Details first. The board resolution uses this data.{' '}

            <button

              type="button"

              onClick={() => router.push(pre1StepHref)}

              className="font-medium text-ink underline underline-offset-2 hover:text-brand-text"

            >

              Open Client Details

            </button>

          </p>

        )}

        {generateErrorDisplay && !loading && (

          <div

            className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger"

            role="alert"

          >

            <p className="flex items-start gap-2 font-medium text-ink">

              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />

              {generateErrorDisplay.title}

            </p>

            <p className="mt-1 pl-6 text-ink-muted">{generateErrorDisplay.description}</p>

            {generateErrorDisplay.missingFieldRefs?.length && generateError?.code === 'missing_fields' ? (
              <ul className="mt-2 space-y-1 pl-6" aria-label="Missing information">
                {generateErrorDisplay.missingFieldRefs.map((ref) => (
                  <li key={`${ref.stepId}:${ref.fieldId}:${ref.label}`}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          docPackStepPath(eng, staffShell, ref.stepId, ref.section ? sectionSlug(ref.section) : undefined),
                        )
                      }
                      className="text-left text-[12.5px] font-medium text-brand hover:underline"
                    >
                      {missingFieldRefText(ref)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {generateError?.code === 'step1_incomplete' && (

              <button

                type="button"

                onClick={() => router.push(pre1StepHref)}

                className="mt-2 pl-6 text-[12px] font-medium text-brand hover:underline"

              >

                Open Client Details

              </button>

            )}

          </div>

        )}

        {isFinalized && doc?.signedStoragePath?.trim() && signedDownloadHref && (

          <div className="mb-4 rounded-md border border-positive/25 bg-positive/10 px-4 py-3">

            <p className="text-[13px] font-medium text-ink mb-1">

              Signed copy uploaded

            </p>

            <p className="text-[12px] text-ink-muted mb-3">

              {doc.signedUploadedAt

                ? `Received ${new Date(doc.signedUploadedAt).toLocaleString('en-IN', {

                    dateStyle: 'medium',

                    timeStyle: 'short',

                  })}`

                : 'A signed board resolution is on file.'}

            </p>

            <a

              href={signedDownloadHref}

              className="inline-flex items-center gap-2 text-[13px] font-medium text-brand hover:underline"

            >

              <Download className="w-3.5 h-3.5" />

              Download signed copy

            </a>

          </div>

        )}

        {isFinalized && previewStorageCorrupt && !loading && (

          <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-[13px]">

            <p className="flex items-start gap-2 font-medium text-ink">

              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />

              Finalized, but the stored Word file needs repair

            </p>

            <p className="mt-1 pl-6 text-ink-muted">

              Inline editing stays locked after finalization. You can still use Apply latest template

              or Re-generate from Pre-1 below to fix the file in storage for the client download.

            </p>

          </div>

        )}

        {noc && signed ? (
          <div className="mb-4">
          <NocReceiveCard
            noc={noc}
            busy={nocState.busy}
            act={nocState.act}
            hasSignedCopy={signed}
            onAccepted={() => toastSuccess('Signed copy accepted', 'Filed in Documents › Vault')}
            onError={nocError}
          />
          </div>
        ) : null}

        <BoardResolutionEditorDocPanel {...p} />
      </div>
      <aside className="surface min-w-0 overflow-hidden lg:sticky lg:top-[var(--shell-sticky-top)]" aria-label="Stage">
        <div className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-4 py-2">
          <CardHeadTile title="Stage" />
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Stage</h2>
        </div>
        <div className="p-2">
          <BrStageList stages={brStages(doc, Boolean(withManager), Boolean(isFinalized), sentToClientAt)} />
          {!isLead && !isFinalized && withManager ? (
            <div className="mt-1 grid gap-2 border-t border-line-soft px-2 pb-1 pt-3">
              <Button size="sm" disabled={busy !== null} onClick={() => void handleApprove()}>
                <CheckCircle2 size={14} strokeWidth={1.6} aria-hidden />
                {busy === 'finalize' ? 'Approving…' : 'Approve and send to client'}
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setBackOpen(true)}>
                <Undo2 size={14} strokeWidth={1.6} aria-hidden />
                Send back
              </Button>
            </div>
          ) : null}
          {isFinalized && !signed ? (
            <div className="mt-1 grid gap-2 border-t border-line-soft px-2 pb-1 pt-3">
              <p className="text-[13px] text-ink-muted">
                {sentToClientAt ? `Sent to client ${dayMonth(sentToClientAt)}` : 'Next: send to client'}
              </p>
              <Button size="sm" variant={sentToClientAt ? 'outline' : 'default'} disabled={sending} onClick={() => void sendToClient()}>
                <Send size={14} strokeWidth={1.6} aria-hidden />
                {sentToClientAt ? 'Send again' : 'Send to client'}
              </Button>
              {/* S-574: staff upload the signed copy the client returned by mail or by hand. */}
              <Button
                size="sm"
                variant={sentToClientAt ? 'default' : 'outline'}
                disabled={busy !== null}
                onClick={() => signedInputRef.current?.click()}
              >
                <Upload size={14} strokeWidth={1.6} aria-hidden />
                {busy === 'upload-signed' ? 'Uploading…' : 'Upload signed copy'}
              </Button>
              <input
                ref={signedInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                aria-label="Signed board resolution file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleUploadSigned(file);
                }}
              />
            </div>
          ) : null}
        </div>
      </aside>
      </div>
      {noc ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          <NocTemplateCard
            noc={noc}
            busy={nocState.busy}
            act={nocState.act}
            onMakeAgain={makeAgain}
            makingAgain={makingAgain}
            loadVersions={nocState.loadVersions}
            onError={nocError}
          />
          <NocWhyCard noc={noc} />
        </div>
      ) : null}
      <Dialog open={backOpen} onOpenChange={setBackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send the board resolution back</DialogTitle>
          </DialogHeader>
          <Textarea
            value={backNote}
            onChange={(event) => setBackNote(event.target.value)}
            rows={4}
            maxLength={2000}
            aria-label="What should the project lead change"
            placeholder="Tell the project lead what to change."
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBackOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!backNote.trim() || busy !== null}
              onClick={async () => {
                if (await handleSendBack(backNote)) {
                  setBackOpen(false);
                  setBackNote('');
                }
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Send for manager approval?</AlertDialogTitle>

            <AlertDialogDescription>
              The document locks until your manager approves it or sends it back.
            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel disabled={busy === 'finalize'}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              disabled={busy === 'finalize'}
              onClick={(e) => {
                e.preventDefault();
                void handleFinalize();
              }}
            >

              {busy === 'finalize' ? 'Sending…' : 'Send for manager approval'}

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </PageTransition>


  );
}
