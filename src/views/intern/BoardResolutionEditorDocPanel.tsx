'use client';

'use client';

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import {

  AlertTriangle,

  ArrowLeft,

  Download,

  FileText,


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
  type BoardResolutionErrorDisplay,
} from '@/lib/api/board-resolution-errors';
import type { BoardResolutionPreviewError } from '@/lib/board-resolution-preview-errors';
import type { Engagement } from '@/data/engagements';

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



/**
 * Full props bag produced by `useBoardResolutionEditorState` and threaded through
 * `BoardResolutionEditorView` → `BoardResolutionEditorDocPanel`. Both components read a
 * subset of these fields; the parent guards `eng` before rendering, so `eng` is non-null here.
 */
export interface BoardResolutionEditorProps {
  BOARD_RESOLUTION_DOCX_FILENAME: string;
  applyLatestTemplate: () => Promise<void>;
  busy: 'finalize' | 'generate' | 'apply-template' | null;
  doc: BoardResolutionDoc | null;
  downloadHref: string;
  eng: Engagement;
  finalizeOpen: boolean;
  generateError: BoardResolutionApiErrorBody | null;
  generateErrorDisplay: BoardResolutionErrorDisplay | null;
  handleCorruptionAutoRepair: () => Promise<boolean>;
  handleDocumentChange: (content: string) => void;
  handleFinalize: () => Promise<void>;
  handleGenerate: () => Promise<void>;
  handleManualSave: () => Promise<void>;
  hasDocx: boolean;
  hasPre1Data: boolean;
  internBoardResolutionPath: typeof internBoardResolutionPath;
  isFinalized: boolean;
  loading: boolean;
  mergeFields: BoardResolutionMergeFields;
  pre1StepHref: string;
  previewDownloadHref: string;
  previewReady: boolean;
  previewRef: React.RefObject<BoardResolutionDocPreviewHandle | null>;
  previewRefreshKey: number;
  previewStorageCorrupt: boolean;
  repairActionsDisabled: boolean;
  saveStatus: SaveStatus;
  saveStatusText: string | null;
  setFinalizeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPreviewError: React.Dispatch<React.SetStateAction<BoardResolutionPreviewError | null>>;
  setPreviewReady: React.Dispatch<React.SetStateAction<boolean>>;
  signedDownloadHref: string;
}

export function BoardResolutionEditorDocPanel(p: BoardResolutionEditorProps) {
  const {
    BOARD_RESOLUTION_DOCX_FILENAME,
    applyLatestTemplate,
    busy,
    doc,
    downloadHref,
    eng,
    handleCorruptionAutoRepair,
    handleDocumentChange,
    handleGenerate,
    handleManualSave,
    hasDocx,
    isFinalized,
    loading,
    mergeFields,
    previewDownloadHref,
    previewReady,
    previewRef,
    previewRefreshKey,
    previewStorageCorrupt,
    repairActionsDisabled,
    saveStatus,
    saveStatusText,
    setFinalizeOpen,
    setPreviewError,
    setPreviewReady,
  } = p;
  return (
    <>
        {loading ? (

          <div className="flex items-center gap-2 text-[12px] text-text-tertiary py-12">

            <HexgridLoader size="sm" />

            Loading board resolution…

          </div>

        ) : (

          <>

            {hasDocx ? (

              <>

                <div className="mb-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[12px] uppercase tracking-wider text-blue-600 font-semibold">
                      Document preview
                    </p>
                    {!isFinalized && saveStatusText && (
                      <p
                        className="text-[11px] text-text-tertiary"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {saveStatusText}
                      </p>
                    )}
                  </div>

                  {!isFinalized && (
                    <FormatToolbar
                      disabled={!previewReady || isFinalized || !hasDocx || saveStatus === 'saving'}
                      previewRef={previewRef}
                      onFormatChange={() => {
                        const content = previewRef.current?.getDocumentContent();
                        if (content) handleDocumentChange(content);
                      }}
                    />
                  )}

                  <div className="flex items-start justify-center overflow-x-auto">
                    <BoardResolutionDocPreview
                      ref={previewRef}
                      engagementId={eng.id}
                      downloadUrl={previewDownloadHref}
                      refreshKey={previewRefreshKey}
                      editable={!isFinalized}
                      mergeFields={mergeFields}
                      previewLabel="Draft Word document"
                      docMeta={{
                        storagePath: doc?.storagePath,
                        templateFingerprint: doc?.templateFingerprint,
                        updatedAt: doc?.updatedAt,
                        status: doc?.status,
                      }}
                      onDocumentChange={handleDocumentChange}
                      onStatusChange={(status) => setPreviewReady(status === 'ready')}
                      onPreviewErrorClear={() => setPreviewError(null)}
                      onPreviewError={(error) => {
                        setPreviewError(error);
                        if (error.kind === 'corrupt_xml') {
                          toastError(
                            'Automatic repair did not fix the preview',
                            isFinalized
                              ? 'Use Apply latest template or Re-generate from Pre-1 to rebuild the stored file.'
                              : 'Click Apply latest template or Re-generate from Pre-1.',
                          );
                        }
                      }}
                      onCorruptionAutoRepair={handleCorruptionAutoRepair}
                    />
                  </div>
                </div>

                <div className="mb-6 rounded-lg border border-primary/35 bg-primary/5 p-5">

                  <p className="text-[12px] uppercase tracking-wider text-blue-600 font-semibold mb-2">

                    Word document ready

                  </p>

                  <p className="text-[13px] text-text-secondary mb-4 max-w-lg">

                    {previewStorageCorrupt && isFinalized
                      ? 'The stored file could not be previewed. Re-generate or apply the latest template below to rebuild storage; the document stays finalized for the client.'
                      : isFinalized
                        ? 'This is the file clients download after finalization. Re-generate or apply the latest template to refresh it from current Pre-1 data; release status is unchanged.'
                        : 'This is the file clients receive after finalization. Re-generate to apply the latest template and current Pre-1 data.'}

                  </p>

                  <div className="flex flex-wrap gap-2">

                    <a

                      href={downloadHref}

                      download={BOARD_RESOLUTION_DOCX_FILENAME}

                      className="gold-sheen inline-flex items-center justify-center gap-2 rounded-md h-9 px-4 text-[13px] font-medium tracking-tight hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"

                    >

                      <Download className="w-4 h-4" />

                      Download Word document

                    </a>

                    <Button

                      type="button"

                      variant="outline"

                      size="sm"

                      disabled={repairActionsDisabled}

                      onClick={() => void handleGenerate()}

                      className="gap-1.5"

                    >

                      <Sparkles className="w-3.5 h-3.5" />

                      {busy === 'generate' ? 'Generating…' : 'Re-generate from Pre-1'}

                    </Button>

                    <Button

                      type="button"

                      variant="outline"

                      size="sm"

                      disabled={repairActionsDisabled}

                      onClick={() => void applyLatestTemplate()}

                      className="gap-1.5"

                    >

                      <FileText className="w-3.5 h-3.5" />

                      {busy === 'apply-template' ? 'Applying…' : 'Apply latest template'}

                    </Button>

                  </div>

                </div>

              </>

            ) : (

              <div className="mb-6 rounded-md border border-warning/25 bg-warning/10 px-4 py-4 text-[13px] text-warning-text">

                <p className="flex items-start gap-2 font-medium text-ink mb-2">

                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" />

                  Generate the Word document first

                </p>

                <p className="mb-4 pl-6 text-text-secondary">

                  Inline editing and client release require a `.docx` from the board resolution

                  template.

                </p>

                <GoldButton

                  type="button"

                  disabled={isFinalized || busy !== null}

                  onClick={() => void handleGenerate()}

                  className="gap-2 ml-6"

                >

                  <Sparkles className="w-4 h-4" />

                  {busy === 'generate' ? 'Generating…' : 'Generate Word document from Pre-1'}

                </GoldButton>

              </div>

            )}

            <div className="flex flex-wrap gap-2 mt-5">

              {!isFinalized && hasDocx && (
                <GoldButton
                  type="button"
                  size="sm"
                  disabled={!previewReady || busy !== null || saveStatus === 'saving'}
                  onClick={() => void handleManualSave()}
                >
                  {saveStatus === 'saving' ? 'Saving…' : 'Save changes'}
                </GoldButton>
              )}

              <Button
                type="button"
                variant="success"
                disabled={
                  busy !== null ||
                  saveStatus === 'saving' ||
                  saveStatus === 'pending' ||
                  (isFinalized && !hasDocx)
                }
                onClick={() => setFinalizeOpen(true)}
              >
                {isFinalized ? 'Send to client' : 'Finalize for client'}
              </Button>

            </div>

            {doc?.finalizedAt && (

              <p className="text-[11.5px] text-text-tertiary mt-4">

                Finalized{' '}

                {new Date(doc.finalizedAt).toLocaleString('en-IN', {

                  dateStyle: 'medium',

                  timeStyle: 'short',

                })}

              </p>

            )}

          </>

        )}
    </>
  );
}
