'use client';

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import {

  AlertTriangle,

  ArrowLeft,

  Download,

  FileText,

  Lock,

  Sparkles,

} from 'lucide-react';

import { useApp } from '@/context/AppContext';

import { PageTransition } from '@/components/shell/PageTransition';

import { SEO } from '@/components/SEO';

import { BoardResolutionDocPreview, type BoardResolutionDocPreviewHandle } from '@/components/board-resolution/BoardResolutionDocPreview';
import { DocxPreviewFormatToolbarContainer } from '@/components/docx-preview/DocxPreviewFormatToolbarContainer';

import { HexgridLoader } from '@/components/common/HexgridLoader';

import { Eyebrow, GoldButton } from '@/components/noir';

import { Button } from '@/components/ui/button';

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

import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';

import { buildBoardResolutionMergeFields, extractBoardResolutionInlineOverrides, type BoardResolutionDoc, type BoardResolutionMergeFields } from '@/lib/board-resolution';

import { BOARD_RESOLUTION_DOCX_FILENAME } from '@/lib/board-resolution-storage';

import {

  fetchBoardResolutionInDb,

  finalizeBoardResolutionInDb,

  saveBoardResolutionDraftInDb,

} from '@/lib/engagements-db';

import { internBoardResolutionPath, internEngagementStepPath } from '@/lib/project-step-path';

import {

  engagementRouteParamFromParams,

  resolveEngagementFromRouteParam,

} from '@/lib/slug';

import { toastError, toastSuccess } from '@/lib/toast-errors';
import { useRealtimeBoardResolution } from '@/lib/supabase/use-realtime-board-resolution';
import {
  formatBoardResolutionErrorDisplay,
  type BoardResolutionApiErrorBody,
} from '@/lib/api/board-resolution-errors';
import type { BoardResolutionPreviewError } from '@/lib/board-resolution-preview-errors';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 5000;

function showBoardResolutionFailure(
  err: unknown,
  fallbackTitle: string,
  setGenerateError?: (body: BoardResolutionApiErrorBody | null) => void,
) {
  const body =
    typeof err === 'object' && err !== null && 'error' in err
      ? (err as BoardResolutionApiErrorBody)
      : {
          ok: false as const,
          error: err instanceof Error ? err.message : 'Try again in a moment.',
        };
  if (setGenerateError && body.ok === false) {
    setGenerateError(body);
  }
  const display = formatBoardResolutionErrorDisplay(body, fallbackTitle);
  toastError(display.title, display.description);
}

function saveStatusLabel(status: SaveStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Unsaved changes';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'All changes saved';
    case 'error':
      return 'Save failed';
    default:
      return null;
  }
}

function previewBlobVersionFromDoc(doc: BoardResolutionDoc | null): string | null {
  const v = doc?.updatedAt ?? doc?.storagePath ?? null;
  return v?.trim() ? v.trim() : null;
}

type FormatToolbarProps = {
  disabled: boolean;
  previewRef: React.RefObject<BoardResolutionDocPreviewHandle | null>;
  onFormatChange: () => void;
};

function FormatToolbar({ disabled, previewRef, onFormatChange }: FormatToolbarProps) {
  return (
    <DocxPreviewFormatToolbarContainer
      disabled={disabled}
      previewRef={previewRef}
      className="mb-3"
      onFormatChange={onFormatChange}
    />
  );
}


import {
  BoardResolutionEditorDocPanel,
  type BoardResolutionEditorProps,
} from '@/views/intern/BoardResolutionEditorDocPanel';

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
  } = p;
  return (

    <PageTransition>

      <SEO

        title={`Board Resolution — ${eng.companyName}`}

        description="Draft and finalize the certified board resolution for the India subsidiary."

        path={internBoardResolutionPath(eng)}

      />

      <button

        type="button"

        onClick={() => router.push(internEngagementStepPath(eng, 'pre-2'))}

        className="text-[12px] text-text-tertiary hover:text-ink flex items-center gap-1 mb-4"

      >

        <ArrowLeft className="w-3.5 h-3.5" />

        {eng.companyName}

      </button>

      <div className="surface p-6 md:p-8 max-w-4xl">

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">

          <div>

            <Eyebrow>Legal document</Eyebrow>

            <h1 className="serif text-[28px] text-ink tracking-tight mt-1 flex items-center gap-2">

              <FileText className="w-6 h-6 text-blue-600 shrink-0" />

              Board Resolution

            </h1>

            <p className="text-[13px] text-text-tertiary mt-2 max-w-xl">

              Generate the Word document from Pre-1 data, edit the full document in the preview, then

              finalize so the client can download the `.docx`.

            </p>

          </div>

          {isFinalized && (

            <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-success/10 text-success-text border border-success/20">

              <Lock className="w-3.5 h-3.5" />

              Finalized — client visible

            </span>

          )}

        </div>

        {!hasPre1Data && !loading && (

          <p className="text-[12.5px] text-warning-text bg-warning/10 border border-warning/20 rounded-md px-3 py-2 mb-4">

            Step 1 (Name Application) data is not available yet. The client must submit Step 1 before

            you can generate the board resolution.{' '}

            <button

              type="button"

              onClick={() => router.push(pre1StepHref)}

              className="font-medium text-ink underline underline-offset-2 hover:text-blue-700"

            >

              Open Step 1

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

            {generateError?.code === 'step1_incomplete' && (

              <button

                type="button"

                onClick={() => router.push(pre1StepHref)}

                className="mt-2 pl-6 text-[12px] font-medium text-brand hover:underline"

              >

                Go to Step 1 — Name Application

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
              {isFinalized ? 'Send board resolution to client?' : 'Finalize board resolution?'}
            </AlertDialogTitle>

            <AlertDialogDescription>

              {isFinalized
                ? 'This opens an email to the client from your linked Outlook mailbox. They can download the Word file, sign it, and upload the signed copy.'
                : 'The client will receive the generated Word document to download, sign, and re-upload. You will not be able to edit this record after finalization.'}

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

              {busy === 'finalize' ? 'Finalizing…' : isFinalized ? 'Send to client' : 'Finalize'}

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </PageTransition>


  );
}
