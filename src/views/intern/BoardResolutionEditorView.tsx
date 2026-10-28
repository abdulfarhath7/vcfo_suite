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
import { FileBadge } from '@/components/ui/file-badge';


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
  return (

    <PageTransition>

      <SEO

        title={`Board Resolution — ${eng.companyName}`}

        description="Draft and finalize the certified board resolution for the India subsidiary."

        path={internBoardResolutionPath(eng)}

      />

      <div className="surface max-w-4xl p-5 md:p-6">

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">

          {/* Plain head (prototype `BoardResolutionScreen`): file badge, 28px title, the company
              in a muted line. No back link (R-09); the step page leads here and back. */}
          <div className="flex min-w-0 items-center gap-3">
            <FileBadge type="DOCX" />
            <div className="min-w-0">
              <h1 className="min-w-0 text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">
                Board resolution
              </h1>
              <p className="text-[13.5px] text-ink-muted">Legal document</p>
            </div>
          </div>

          {isFinalized && (

            <Chip tone="ok" title="Finalized — client visible">
              Finalized
            </Chip>

          )}

        </div>

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
      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>
              Send the board resolution for manager approval?
            </AlertDialogTitle>

            <AlertDialogDescription>

              Your manager reads the document and the Client Details it uses. When they approve it, the
              client can download, sign and upload it. You cannot edit it while your manager decides.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel disabled={busy === 'finalize'}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              className="bg-positive text-on-brand hover:bg-positive/90 focus-visible:ring-positive/40"
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
