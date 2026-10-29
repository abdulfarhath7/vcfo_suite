'use client';

'use client';


import { useRouter } from 'next/navigation';

import {

  AlertTriangle,

  Download,

} from 'lucide-react';


import { PageTransition } from '@/components/shell/PageTransition';

import { SEO } from '@/components/SEO';



import { Chip } from '@/components/ui/spectrum-chip';
import { StepMark } from '@/components/ui/step-track';
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

/** "NIC code — Client Details, Business Description" */
function missingFieldRefText(ref: BoardResolutionMissingFieldRef): string {
  const where = [getItem(ref.stepId)?.title, ref.section].filter(Boolean).join(', ');
  return where ? `${ref.label} — ${where}` : ref.label;
}

type BrStage = { key: string; label: string; done: boolean };

/**
 * The five stages of a board resolution (prototype `BoardResolutionScreen` stepper), from the
 * stored document only: a Word file exists, the draft left the lead (with the manager or
 * finalized), it is finalized for the client, and the client uploaded the signed copy. The real
 * tool does not record a separate "sent to the client" moment: finalizing makes the file visible
 * on the client portal, so "Sent to client" is done with "Finalized".
 */
function brStages(doc: BoardResolutionEditorProps['doc'], withManager: boolean, isFinalized: boolean): BrStage[] {
  const generated = Boolean(doc?.storagePath?.trim() || doc?.content?.trim());
  const signed = Boolean(doc?.signedStoragePath?.trim());
  return [
    { key: 'generated', label: 'Generated from Pre-1', done: generated },
    { key: 'draft', label: 'Draft · editing', done: withManager || isFinalized },
    { key: 'finalized', label: 'Finalized · client visible', done: isFinalized },
    { key: 'sent', label: 'Sent to client', done: isFinalized },
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
          {i < stages.length - 1 ? (
            <span
              aria-hidden
              className={cn('absolute bottom-[-8px] left-[17px] top-[28px] w-[1.5px]', x.done ? 'bg-positive-mid' : 'bg-line')}
            />
          ) : null}
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
  const {
    eng,
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
  } = p;
  const signed = Boolean(doc?.signedStoragePath?.trim());
  const stageWord = signed ? 'Signed' : isFinalized ? 'Finalized' : withManager ? 'With manager' : 'Draft';
  const stageTone = signed || isFinalized ? 'ok' : withManager ? 'teal' : 'warn';
  return (

    <PageTransition>

      <SEO

        title={`Board Resolution — ${eng.companyName}`}

        description="Draft and finalize the certified board resolution for the India subsidiary."

        path={internBoardResolutionPath(eng)}

      />

      {/* Plain head (prototype `BoardResolutionScreen`): the 44px client tile, the 28px title and
          the stage chip, then the client and the step code. No back link (R-09). */}
      <header className="mb-5 flex min-w-0 items-start gap-3">
        <RecordTile name={eng.companyName} identityId={eng.id} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Board resolution</h1>
            <Chip tone={stageTone} fixed>
              {stageWord}
            </Chip>
          </div>
          <p className="text-[13.5px] text-ink-muted">
            {eng.companyName} · <span className="font-mono text-[13px]">Pre-2</span>
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="min-w-0">

        {withManager && !isFinalized ? (
          <p role="status" className="mb-4 rounded-md border-1.5 border-brand-line bg-brand-soft px-3 py-2 text-[13.5px] text-ink">
            The board resolution is with your manager. You can edit it again if they send it back.
          </p>
        ) : null}

        {sentBackNote && !withManager && !isFinalized ? (
          <p role="status" className="mb-4 rounded-md border-1.5 border-warning-mid bg-warning-soft px-3 py-2 text-[13.5px] text-ink">
            <span className="font-medium">Your manager sent this back:</span> {sentBackNote}
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
                          docPackStepPath(eng, 'intern', ref.stepId, ref.section ? sectionSlug(ref.section) : undefined),
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

              Client uploaded signed copy

            </p>

            <p className="text-[12px] text-ink-muted mb-3">

              {doc.signedUploadedAt

                ? `Received ${new Date(doc.signedUploadedAt).toLocaleString('en-IN', {

                    dateStyle: 'medium',

                    timeStyle: 'short',

                  })}`

                : 'The client has uploaded a signed board resolution.'}

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

        <BoardResolutionEditorDocPanel {...p} />
      </div>
      <aside className="surface min-w-0 overflow-hidden lg:sticky lg:top-[var(--shell-sticky-top)]" aria-label="Stage">
        <div className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-4 py-2">
          <CardHeadTile title="Stage" />
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Stage</h2>
        </div>
        <div className="p-2">
          <BrStageList stages={brStages(doc, Boolean(withManager), Boolean(isFinalized))} />
        </div>
      </aside>
      </div>
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
