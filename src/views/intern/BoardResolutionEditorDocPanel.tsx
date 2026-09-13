'use client';

'use client';

'use client';



import {

  AlertTriangle,

  Download,

  FileText,


  Sparkles,

} from 'lucide-react';




import { BoardResolutionDocPreview, type BoardResolutionDocPreviewHandle } from '@/components/board-resolution/BoardResolutionDocPreview';
import { DocxPreviewFormatToolbarContainer } from '@/components/docx-preview/DocxPreviewFormatToolbarContainer';

import { HexgridLoader } from '@/components/common/HexgridLoader';

import { AccentButton } from '@/components/noir';

import { Button } from '@/components/ui/button';







import { type BoardResolutionDoc, type BoardResolutionMergeFields } from '@/lib/board-resolution';







import { internBoardResolutionPath } from '@/lib/project-step-path';






import { toastError } from '@/lib/toast-errors';
import {
  type BoardResolutionApiErrorBody,
  type BoardResolutionErrorDisplay,
} from '@/lib/api/board-resolution-errors';
import type { BoardResolutionPreviewError } from '@/lib/board-resolution-preview-errors';
import type { Engagement } from '@/data/engagements';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

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

                <AccentButton

                  type="button"

                  disabled={isFinalized || busy !== null}

                  onClick={() => void handleGenerate()}

                  className="gap-2 ml-6"

                >

                  <Sparkles className="w-4 h-4" />

                  {busy === 'generate' ? 'Generating…' : 'Generate Word document from Pre-1'}

                </AccentButton>

              </div>

            )}

            <div className="flex flex-wrap gap-2 mt-5">

              {!isFinalized && hasDocx && (
                <AccentButton
                  type="button"
                  size="sm"
                  disabled={!previewReady || busy !== null || saveStatus === 'saving'}
                  onClick={() => void handleManualSave()}
                >
                  {saveStatus === 'saving' ? 'Saving…' : 'Save changes'}
                </AccentButton>
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
