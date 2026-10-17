'use client';

'use client';


import { useRouter } from 'next/navigation';

import {

  AlertTriangle,

  Download,

  FileText,

  Lock,

} from 'lucide-react';


import { PageTransition } from '@/components/shell/PageTransition';

import { SEO } from '@/components/SEO';



import { Eyebrow } from '@/components/noir';


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









import { PageBackButton } from '@/components/shell/PageBackButton';






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

      <div className="surface p-6 md:p-8 max-w-4xl">

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">

          <div>

            <Eyebrow>Legal document</Eyebrow>

            <div className="mt-1 flex min-w-0 items-center gap-1.5">

              <PageBackButton className="-ml-1.5" />

              <h1 className="serif text-[28px] text-ink tracking-tight flex min-w-0 items-center gap-2">

                <FileText className="w-6 h-6 text-blue-600 shrink-0" />

                Board Resolution

              </h1>

            </div>

          </div>

          {isFinalized && (

            <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-success/10 text-success-text border border-success/20">

              <Lock className="w-3.5 h-3.5" />

              Finalized — client visible

            </span>

          )}

        </div>

        {withManager && !isFinalized ? (
          <p role="status" className="mb-4 rounded-md border border-primary/30 bg-primary-light px-3 py-2 text-[12.5px] text-foreground">
            The board resolution is with your manager. You can edit it again if they send it back.
          </p>
        ) : null}

        {sentBackNote && !withManager && !isFinalized ? (
          <p role="status" className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-foreground">
            <span className="font-medium">Your manager sent this back:</span> {sentBackNote}
          </p>
        ) : null}

        {!hasPre1Data && !loading && (

          <p className="text-[12.5px] text-warning-text bg-warning/10 border border-warning/20 rounded-md px-3 py-2 mb-4">

            Submit Client Details first. The board resolution uses this data.{' '}

            <button

              type="button"

              onClick={() => router.push(pre1StepHref)}

              className="font-medium text-ink underline underline-offset-2 hover:text-blue-700"

            >

              Open Client Details

            </button>

          </p>

        )}

        {generateErrorDisplay && !loading && (

          <div

            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive"

            role="alert"

          >

            <p className="flex items-start gap-2 font-medium text-ink">

              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />

              {generateErrorDisplay.title}

            </p>

            <p className="mt-1 pl-6 text-text-secondary">{generateErrorDisplay.description}</p>

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

          <div className="mb-4 rounded-md border border-success/25 bg-success/10 px-4 py-3">

            <p className="text-[13px] font-medium text-ink mb-1">

              Client uploaded signed copy

            </p>

            <p className="text-[12px] text-text-secondary mb-3">

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

              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" />

              Finalized, but the stored Word file needs repair

            </p>

            <p className="mt-1 pl-6 text-text-secondary">

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
              className="bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/40"
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
