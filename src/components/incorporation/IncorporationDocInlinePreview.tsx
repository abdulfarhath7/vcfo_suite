'use client';

import { Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { GoldButton } from '@/components/noir';
import { useApp } from '@/context/AppContext';
import {
  DocxPreviewFormatToolbarContainer,
} from '@/components/docx-preview/DocxPreviewFormatToolbarContainer';
import {
  IncorporationDocxPreview,
  type IncorporationDocxPreviewHandle,
} from '@/components/incorporation/IncorporationDocxPreview';
import type { IncorpDocFlushRegistrar } from '@/components/incorporation/IncorporationDocsBulkShareBar';
import { formatIncorpDocsErrorDisplay } from '@/lib/api/incorporation-docs-errors';
import { buildIncorpDocDownloadUrl } from '@/lib/incorporation-docs/preview-url';
import {
  incorpDocRowKey,
  type IncorpDraftDocSlot,
} from '@/lib/incorporation-docs/paths';
import { draftUrlFieldFor } from '@/lib/incorporation-docs/types';
import type { IncorpDraftDocLink } from '@/lib/incorporation-docs/paths';
import type { IncorpDocAudience } from '@/lib/incorporation-docs/shared';
import type { IncorpDocKind } from '@/lib/incorporation-docs/types';
import { fileNameFromStoragePath } from '@/lib/milestone-document-storage';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import {
  INCORP_DOC_AUTOSAVE_DEBOUNCE_MS,
  incorpDocSaveStatusLabel,
  type IncorpDocSaveStatus,
} from '@/lib/incorporation-docs/preview-save';
import { cn } from '@/lib/utils';

export type IncorporationDocInlinePreviewProps = {
  engagementId: string;
  doc: IncorpDocKind;
  director: IncorpDocAudience;
  storagePath: string;
  label: string;
  /** Checklist step that owns draft URL fields (incorporation drafts live on Pre-7). */
  checklistItemId?: string;
  className?: string;
  /** When false, only show download link — no DOCX preview fetch on mount. */
  showDocxPreview?: boolean;
  /** Show Save / Download action bar (intern/admin with preview). */
  showDocActions?: boolean;
  /** Inline editing + format toolbar in the preview (intern/admin only). */
  editable?: boolean;
  /** Shown under the header when `showDocxPreview` is false; omit for download-only rows. */
  docxPreviewPlaceholder?: string | null;
  allowRegenerate?: boolean;
  /** Register autosave flush for panel-level bulk share. */
  onFlushRegister?: IncorpDocFlushRegistrar;
};

async function patchIncorpDocContent(
  engagementId: string,
  doc: IncorpDocKind,
  director: IncorpDocAudience,
  content: string,
): Promise<void> {
  const res = await fetch(`/api/engagements/${engagementId}/incorporation-docs/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docs: [doc], directors: [director], content }),
  });

  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? 'Could not save inline edits.');
  }
}

type PreviewState = {
  activeStoragePath: string;
  refreshNonce: number;
  previewReady: boolean;
  saveStatus: IncorpDocSaveStatus;
  pendingContent: string | null;
};
type PreviewAction =
  | { type: 'patch'; patch: Partial<PreviewState> }
  | { type: 'bump_refresh'; nextPath: string };

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  if (action.type === 'bump_refresh') {
    return {
      ...state,
      activeStoragePath: action.nextPath,
      pendingContent: null,
      saveStatus: 'saved',
      refreshNonce: state.refreshNonce + 1,
    };
  }
  return action.type === 'patch' ? { ...state, ...action.patch } : state;
}

export function IncorporationDocInlinePreview({
  engagementId,
  doc,
  director,
  storagePath,
  label,
  checklistItemId = 'pre-7',
  className,
  showDocxPreview = true,
  showDocActions = true,
  editable = true,
  docxPreviewPlaceholder,
  allowRegenerate = false,
  onFlushRegister,
}: IncorporationDocInlinePreviewProps) {
  const { mergeEngagementChecklistResponses, refreshEngagementChecklist } = useApp();
  const previewRef = useRef<IncorporationDocxPreviewHandle>(null);
  const contentDirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const [preview, dispatch] = useReducer(previewReducer, {
    activeStoragePath: storagePath,
    refreshNonce: 0,
    previewReady: false,
    saveStatus: 'idle' as IncorpDocSaveStatus,
    pendingContent: null,
  });
  const { activeStoragePath, refreshNonce, previewReady, saveStatus, pendingContent } = preview;

  const prevStoragePathRef = useRef(storagePath);
  if (storagePath !== prevStoragePathRef.current) {
    prevStoragePathRef.current = storagePath;
    dispatch({
      type: 'patch',
      patch: { activeStoragePath: storagePath, pendingContent: null, saveStatus: 'idle' },
    });
    contentDirtyRef.current = false;
  }

  const handleDocumentChange = useCallback((content: string) => {
    if (!editable) return;
    contentDirtyRef.current = true;
    dispatch({ type: 'patch', patch: { pendingContent: content, saveStatus: 'pending' } });
  }, [editable]);

  const persistContent = useCallback(
    async (content: string): Promise<boolean> => {
      dispatch({ type: 'patch', patch: { saveStatus: 'saving' } });
      try {
        await patchIncorpDocContent(engagementId, doc, director, content);
        contentDirtyRef.current = false;
        dispatch({ type: 'patch', patch: { pendingContent: null, saveStatus: 'saved' } });
        return true;
      } catch (err) {
        dispatch({ type: 'patch', patch: { saveStatus: 'error' } });
        toastError(
          'Could not save changes',
          err instanceof Error ? err.message : 'Try again in a moment.',
        );
        return false;
      }
    },
    [engagementId, doc, director],
  );

  useEffect(() => {
    if (!pendingContent?.trim() || !editable || !showDocxPreview) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistContent(pendingContent);
    }, INCORP_DOC_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [pendingContent, editable, showDocxPreview, persistContent]);

  const rowKey = incorpDocRowKey(doc, director);

  const previewUrl = buildIncorpDocDownloadUrl(engagementId, doc, director);
  const apiDownloadUrl = previewUrl;
  const fileName = fileNameFromStoragePath(activeStoragePath);
  const previewRefreshKey = `${activeStoragePath}:${refreshNonce}`;

  const flushPendingAutosave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const content =
      pendingContent?.trim() || previewRef.current?.getDocumentContent().trim() || '';
    if (!content || !contentDirtyRef.current) return true;
    return persistContent(content);
  }, [pendingContent, persistContent]);

  useEffect(() => {
    if (!onFlushRegister || !editable || !showDocxPreview) return;
    return () => {
      onFlushRegister(rowKey, null);
    };
  }, [onFlushRegister, rowKey, editable, showDocxPreview]);

  if (onFlushRegister && editable && showDocxPreview) {
    onFlushRegister(rowKey, flushPendingAutosave);
  }

  const handleManualSave = useCallback(async () => {
    const content =
      pendingContent?.trim() || previewRef.current?.getDocumentContent().trim() || '';
    if (!content?.trim()) {
      toastError('Nothing to save', 'Edit the document in the preview first.');
      return;
    }
    const ok = await persistContent(content);
    if (ok) {
      toastSuccess('Changes saved', `${label} was saved to storage.`);
    }
  }, [label, pendingContent, persistContent]);

  async function regenerateDraft() {
    const res = await fetch(`/api/engagements/${engagementId}/incorporation-docs/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docs: [doc], directors: [director] }),
    });

    const body = (await res.json()) as {
      ok?: boolean;
      error?: string;
      responsePatch?: Record<string, string>;
    };

    if (!res.ok || body.ok === false) {
      throw new Error(body.error ?? 'Could not re-generate this draft.');
    }

    const fieldId = draftUrlFieldFor(doc, director);
    const nextPath = fieldId ? body.responsePatch?.[fieldId]?.trim() : '';
    if (nextPath && fieldId) {
      mergeEngagementChecklistResponses(engagementId, checklistItemId, { [fieldId]: nextPath });
      dispatch({ type: 'patch', patch: { activeStoragePath: nextPath } });
      await refreshEngagementChecklist(engagementId);
    } else if (nextPath) {
      dispatch({ type: 'patch', patch: { activeStoragePath: nextPath } });
    }
    contentDirtyRef.current = false;
    dispatch({ type: 'bump_refresh', nextPath });
    toastSuccess('Draft re-generated', `${label} was rebuilt from latest incorporation responses.`);
  }

  const handleRecoverCorruptFile = allowRegenerate
    ? async () => {
        try {
          await regenerateDraft();
        } catch (err) {
          toastError(
            'Could not re-generate draft',
            err instanceof Error ? err.message : 'Try again in a moment.',
          );
          throw err;
        }
      }
    : undefined;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-md border border-border/60 bg-panel',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline px-4 py-2.5">
        <h4 className="text-[12px] font-medium leading-snug text-ink">{label}</h4>
      </header>
      {showDocxPreview ? (
        <div className="overflow-x-auto bg-paper/20 px-4 py-4">
          {editable && (
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <DocxPreviewFormatToolbarContainer
                disabled={!previewReady || saveStatus === 'saving'}
                previewRef={previewRef}
                className="mb-0"
                onFormatChange={() => {
                  const content = previewRef.current?.getDocumentContent();
                  if (content) handleDocumentChange(content);
                }}
              />
              {incorpDocSaveStatusLabel(saveStatus) && (
                <p
                  className="text-[11px] text-text-tertiary"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {incorpDocSaveStatusLabel(saveStatus)}
                </p>
              )}
            </div>
          )}
          <IncorporationDocxPreview
            ref={previewRef}
            downloadUrl={previewUrl}
            previewLabel={label}
            refreshKey={previewRefreshKey}
            editable={editable}
            onDocumentChange={handleDocumentChange}
            onStatusChange={(status) => dispatch({ type: 'patch', patch: { previewReady: status === 'ready' } })}
            onRecoverCorruptFile={handleRecoverCorruptFile}
          />
        </div>
      ) : docxPreviewPlaceholder ? (
        <p className="border-t border-hairline px-4 py-3 text-[11px] leading-relaxed text-text-tertiary">
          {docxPreviewPlaceholder}
        </p>
      ) : null}
      {!editable && activeStoragePath.trim() && !showDocxPreview ? (
        <footer className="border-t border-hairline px-4 py-3">
          <a
            href={apiDownloadUrl}
            download={fileName || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 underline-offset-2 hover:underline"
          >
            <Download className="h-3 w-3 shrink-0" aria-hidden />
            Download
          </a>
        </footer>
      ) : null}
      {showDocActions && showDocxPreview && editable && activeStoragePath.trim() ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-hairline bg-raised/30 px-4 py-3">
          <GoldButton
            type="button"
            size="sm"
            disabled={!previewReady || saveStatus === 'saving'}
            onClick={() => void handleManualSave()}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </GoldButton>
          <a
            href={apiDownloadUrl}
            download={fileName || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!previewReady || saveStatus === 'saving'}
            className={cn(
              'inline-flex h-9 min-h-[44px] items-center justify-center gap-2 rounded-md border px-3 text-xs tracking-tight sm:min-h-9',
              'bg-transparent text-role-foreground role-accent-border',
              'hover:role-accent-bg hover:border-role/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-role/40',
              (!previewReady || saveStatus === 'saving') && 'pointer-events-none opacity-50',
            )}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download
          </a>
        </footer>
      ) : null}
    </article>
  );
}

export type IncorporationDraftDocsPreviewListProps = {
  docs: IncorpDraftDocLink[];
  engagementId: string;
  checklistItemId?: string;
  className?: string;
  showDocxPreview?: boolean;
  editable?: boolean;
  docxPreviewPlaceholder?: string | null;
  allowRegenerate?: boolean;
  onFlushRegister?: IncorpDocFlushRegistrar;
};

/** Stacked inline DOCX previews — one block per generated incorporation draft. */
export function IncorporationDraftDocsPreviewList({
  docs,
  engagementId,
  checklistItemId = 'pre-7',
  className,
  showDocxPreview = true,
  editable = true,
  docxPreviewPlaceholder,
  allowRegenerate = false,
  onFlushRegister,
}: IncorporationDraftDocsPreviewListProps) {
  if (docs.length === 0) return null;

  return (
    <div className={cn('space-y-4', className)}>
      {docs.map((doc) => (
        <IncorporationDocInlinePreview
          key={doc.path}
          engagementId={engagementId}
          checklistItemId={checklistItemId}
          doc={doc.doc}
          director={doc.audience}
          storagePath={doc.path}
          label={doc.label}
          showDocxPreview={showDocxPreview}
          editable={editable && showDocxPreview}
          docxPreviewPlaceholder={docxPreviewPlaceholder}
          allowRegenerate={allowRegenerate}
          onFlushRegister={onFlushRegister}
        />
      ))}
    </div>
  );
}

type GenerateApiResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  missingFields?: string[];
  responsePatch?: Record<string, string>;
};

type IncorporationDocGenerateRowProps = {
  engagementId: string;
  doc: IncorpDocKind;
  director: IncorpDocAudience;
  label: string;
  storagePath?: string;
  /** Checklist step that owns draft URL fields (incorporation drafts live on Pre-7). */
  checklistItemId?: string;
  previewUnlocked: boolean;
  onPreviewUnlock: () => void;
  onStoragePathChange?: (path: string) => void;
  className?: string;
  onFlushRegister?: IncorpDocFlushRegistrar;
};

/** One incorporation draft row: Generate → inline preview + download (no auto-preview on load). */
function IncorporationDocGenerateRow({
  engagementId,
  doc,
  director,
  label,
  storagePath: initialPath = '',
  checklistItemId = 'pre-7',
  previewUnlocked,
  onPreviewUnlock,
  onStoragePathChange,
  className,
  onFlushRegister,
}: IncorporationDocGenerateRowProps) {
  const { mergeEngagementChecklistResponses, refreshEngagementChecklist } = useApp();
  const [generating, setGenerating] = useState(false);
  const [storagePath, setStoragePath] = useState(initialPath);
  const [error, setError] = useState<string | null>(null);

  const prevInitialPathRef = useRef(initialPath);
  if (initialPath !== prevInitialPathRef.current) {
    prevInitialPathRef.current = initialPath;
    setStoragePath(initialPath);
  }

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/incorporation-docs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs: [doc], directors: [director] }),
      });
      const body = (await res.json()) as GenerateApiResponse;
      if (!res.ok || body.ok === false) {
        const display = formatIncorpDocsErrorDisplay({
          ok: false,
          error: body.error,
          code: body.code as import('@/lib/api/incorporation-docs-errors').IncorpDocsErrorCode | undefined,
          missingFields: body.missingFields,
        });
        throw new Error(
          display.missingFields?.length
            ? display.description
            : (body.error ?? display.description),
        );
      }

      const fieldId = draftUrlFieldFor(doc, director);
      const nextPath = fieldId ? body.responsePatch?.[fieldId]?.trim() ?? '' : '';
      if (nextPath) {
        setStoragePath(nextPath);
        onStoragePathChange?.(nextPath);
      }

      if (body.responsePatch && Object.keys(body.responsePatch).length > 0) {
        mergeEngagementChecklistResponses(engagementId, checklistItemId, body.responsePatch);
      }

      await refreshEngagementChecklist(engagementId);
      onPreviewUnlock();
      toastSuccess(`${label} generated`, 'Draft saved — preview is ready below.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Try again in a moment.';
      setError(message);
      toastError('Could not generate document', message);
    } finally {
      setGenerating(false);
    }
  }, [
    checklistItemId,
    director,
    doc,
    engagementId,
    label,
    mergeEngagementChecklistResponses,
    onPreviewUnlock,
    onStoragePathChange,
    refreshEngagementChecklist,
  ]);

  if (previewUnlocked && storagePath.trim()) {
    return (
      <div className={cn('space-y-2', className)}>
        <IncorporationDocInlinePreview
          engagementId={engagementId}
          checklistItemId={checklistItemId}
          doc={doc}
          director={director}
          storagePath={storagePath}
          label={label}
          showDocxPreview
          showDocActions
          editable
          allowRegenerate
          onFlushRegister={onFlushRegister}
        />
        <div className="flex justify-end px-1">
          <GoldButton
            type="button"
            size="sm"
            variant="outline"
            disabled={generating}
            onClick={() => void generate()}
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Re-generating…
              </>
            ) : (
              'Re-generate'
            )}
          </GoldButton>
        </div>
      </div>
    );
  }

  const hasStoredDraft = Boolean(initialPath.trim());

  return (
    <article
      className={cn(
        'overflow-hidden rounded-md border border-border/60 bg-panel',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-hairline px-4 py-2.5">
        <h4 className="text-[12px] font-medium leading-snug text-ink">{label}</h4>
        <GoldButton
          type="button"
          size="sm"
          disabled={generating}
          onClick={() => void generate()}
        >
          {generating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Generating…
            </>
          ) : (
            'Generate'
          )}
        </GoldButton>
      </header>
      <div className="space-y-2 px-4 py-3">
        {hasStoredDraft ? (
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            A stored draft exists on file. Click <strong>Generate</strong> to rebuild from latest
            client data and open the Word preview.
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            Click <strong>Generate</strong> to build this draft from saved KYC and company name
            responses.
          </p>
        )}
        {error ? (
          <p className="text-[11px] leading-relaxed text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export type IncorporationDraftDocsGenerateListProps = {
  slots: IncorpDraftDocSlot[];
  engagementId: string;
  checklistItemId?: string;
  className?: string;
  /** When true, list every incorporation slot (Pre-7). When false, only rows with a stored path (Pre-8). */
  showEmptySlots?: boolean;
  /** Row keys (`doc:director`) with preview unlocked in this session. */
  unlockedKeys: Set<string>;
  onUnlockKey: (key: string) => void;
  onSlotPathChange?: (key: string, path: string) => void;
  onFlushRegister?: IncorpDocFlushRegistrar;
};

/** Per-document Generate rows — preview only after explicit Generate in this session. */
export function IncorporationDraftDocsGenerateList({
  slots,
  engagementId,
  checklistItemId = 'pre-7',
  className,
  showEmptySlots = false,
  unlockedKeys,
  onUnlockKey,
  onSlotPathChange,
  onFlushRegister,
}: IncorporationDraftDocsGenerateListProps) {
  const visibleSlots = useMemo(
    () =>
      showEmptySlots
        ? slots
        : slots.filter(
            (slot) =>
              slot.path.trim() ||
              unlockedKeys.has(incorpDocRowKey(slot.doc, slot.audience)),
          ),
    [showEmptySlots, slots, unlockedKeys],
  );

  if (visibleSlots.length === 0) return null;

  return (
    <div className={cn('space-y-4', className)}>
      {visibleSlots.map((slot) => {
        const key = incorpDocRowKey(slot.doc, slot.audience);
        return (
          <IncorporationDocGenerateRow
            key={key}
            engagementId={engagementId}
            checklistItemId={checklistItemId}
            doc={slot.doc}
            director={slot.audience}
            label={slot.label}
            storagePath={slot.path}
            previewUnlocked={unlockedKeys.has(key)}
            onPreviewUnlock={() => onUnlockKey(key)}
            onStoragePathChange={(path) => onSlotPathChange?.(key, path)}
            onFlushRegister={onFlushRegister}
          />
        );
      })}
    </div>
  );
}

