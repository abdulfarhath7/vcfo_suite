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


export function useBoardResolutionEditorState(props: Record<string, unknown>) {


  const params = useParams();

  const router = useRouter();

  const routeParam = engagementRouteParamFromParams(params);

  const { engagements, getStateForEngagement, refreshEngagementChecklist } = useApp();
  const eng = useMemo(

    () => resolveEngagementFromRouteParam(engagements, routeParam),

    [engagements, routeParam],

  );

  const pre1Item = useMemo(() => checklist.find((c) => c.id === 'pre-1'), []);

  const pre1Responses = useMemo(() => {

    if (!eng || !pre1Item) return {};

    const state = getStateForEngagement(eng);

    return extractItemResponses(pre1Item, state['pre-1']);

  }, [eng, pre1Item, getStateForEngagement]);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState<'finalize' | 'generate' | 'apply-template' | null>(null);

  const [doc, setDoc] = useState<BoardResolutionDoc | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [generateError, setGenerateError] = useState<BoardResolutionApiErrorBody | null>(null);

  /** Bumps only on explicit preview reload (initial mount, re-generate, finalize). */
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  /** Cache-bust param for preview fetch only — not updated on autosave. */
  const [previewBlobVersion, setPreviewBlobVersion] = useState<string | null>(null);

  const previewRef = useRef<BoardResolutionDocPreviewHandle>(null);

  const contentDirtyRef = useRef(false);

  const saveTimerRef = useRef<number | null>(null);

  const templateRefreshInFlightRef = useRef(false);

  const templateRefreshToastRef = useRef<string | null>(null);

  const corruptionAutoRepairInFlightRef = useRef(false);

  const [pendingContent, setPendingContent] = useState<string | null>(null);

  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState<BoardResolutionPreviewError | null>(null);

  const [mergeOverrides, setMergeOverrides] = useState<Partial<BoardResolutionMergeFields>>({});

  const isFinalized = doc?.status === 'finalized';
  const previewStorageCorrupt = previewError?.kind === 'corrupt_xml';
  const repairActionsDisabled = busy !== null || saveStatus === 'saving';

  const hasDocx = Boolean(doc?.storagePath?.trim());

  const hasPre1Data = Boolean(

    pre1Responses.parentEntityName?.trim() || pre1Responses.proposedName1?.trim(),

  );

  const mergeFields = useMemo(
    () => {
      const base = buildBoardResolutionMergeFields({ engagement: eng, pre1: pre1Responses });
      return { ...base, ...mergeOverrides };
    },
    [eng, pre1Responses, mergeOverrides],
  );

  const loadDoc = useCallback(async () => {

    if (!eng?.id) return;

    setLoading(true);

    try {

      const row = await fetchBoardResolutionInDb(eng.id);

      setDoc(row);

      setPreviewBlobVersion(previewBlobVersionFromDoc(row));

      contentDirtyRef.current = false;

      setPendingContent(null);

      setSaveStatus('idle');

    } catch (err) {

      toastError('Could not load board resolution', err instanceof Error ? err.message : 'Try again.');

    } finally {

      setLoading(false);

    }

  }, [eng]);

  useEffect(() => {

    if (!eng?.id) return;

    void refreshEngagementChecklist(eng.id);

  }, [eng?.id, refreshEngagementChecklist]);

  useEffect(() => {

    void loadDoc();

  }, [loadDoc]);

  const reloadDocFromRemote = useCallback(async () => {
    if (!eng?.id || contentDirtyRef.current) return;
    try {
      const row = await fetchBoardResolutionInDb(eng.id);
      setDoc(row);
      setPreviewBlobVersion(previewBlobVersionFromDoc(row));
      setPendingContent(null);
      setSaveStatus('idle');
    } catch {
      // Background sync — avoid interrupting active editing.
    }
  }, [eng?.id]);

  useRealtimeBoardResolution({
    appEngagementId: eng?.id,
    onRemoteChange: () => {
      void reloadDocFromRemote();
    },
  });

  const [syncedEngagementId, setSyncedEngagementId] = useState(eng?.id);
  if (eng?.id !== syncedEngagementId) {
    setSyncedEngagementId(eng?.id);
    setPreviewRefreshKey(0);
    setPreviewBlobVersion(null);
    templateRefreshInFlightRef.current = false;
    templateRefreshToastRef.current = null;
    corruptionAutoRepairInFlightRef.current = false;
    setPreviewError(null);
    setMergeOverrides({});
  }

  const reloadPreviewFromDoc = useCallback((nextDoc: BoardResolutionDoc) => {
    setPreviewBlobVersion(previewBlobVersionFromDoc(nextDoc));
    setPreviewRefreshKey((key) => key + 1);
  }, []);

  const requestGenerate = useCallback(

    async (options?: {
      content?: string;
      forceTemplateRefresh?: boolean;
      overrides?: Partial<BoardResolutionMergeFields>;
    }): Promise<BoardResolutionDoc> => {

      if (!eng?.id) throw new Error('engagement_missing');

      const requestBody: {
        content?: string;
        forceTemplateRefresh?: boolean;
        overrides?: Partial<BoardResolutionMergeFields>;
      } = {};

      if (options?.content) requestBody.content = options.content;

      if (options?.forceTemplateRefresh) requestBody.forceTemplateRefresh = true;

      if (options?.overrides && Object.keys(options.overrides).length > 0) {
        requestBody.overrides = options.overrides;
      }

      const res = await fetch(`/api/engagements/${eng.id}/board-resolution/generate`, {

        method: 'POST',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(requestBody),

      });

      const responseBody = (await res.json()) as BoardResolutionApiErrorBody & {
        doc?: BoardResolutionDoc;
      };

      if (!res.ok || !responseBody.ok || !responseBody.doc) {
        setGenerateError(
          responseBody.ok === false
            ? responseBody
            : {
                ok: false,
                error: responseBody.error ?? 'Could not generate the board resolution.',
              },
        );
        throw responseBody;
      }

      setGenerateError(null);
      return responseBody.doc;

    },

    [eng?.id],

  );

  const handleCorruptionAutoRepair = useCallback(async (): Promise<boolean> => {
    if (!eng?.id || corruptionAutoRepairInFlightRef.current) return false;

    corruptionAutoRepairInFlightRef.current = true;
    try {
      const generated = await requestGenerate({ forceTemplateRefresh: true, overrides: mergeOverrides });
      setDoc(generated);
      contentDirtyRef.current = false;
      setPendingContent(null);
      setSaveStatus('saved');
      setPreviewError(null);
      reloadPreviewFromDoc(generated);
      toastSuccess(
        isFinalized ? 'Stored file repaired' : 'Document repaired',
        isFinalized
          ? 'The finalized Word file in storage was rebuilt. The client can still download the updated document.'
          : 'The stored Word file was rebuilt from the latest template.',
      );
      return true;
    } catch {
      return false;
    } finally {
      corruptionAutoRepairInFlightRef.current = false;
    }
  }, [eng?.id, isFinalized, requestGenerate, reloadPreviewFromDoc, mergeOverrides]);

  const checkAndRefreshTemplate = useCallback(

    async (currentDoc: BoardResolutionDoc) => {

      if (!eng?.id) return;

      if (currentDoc.status === 'finalized') return;

      if (!currentDoc.storagePath?.trim()) return;

      if (templateRefreshInFlightRef.current) return;

      if (contentDirtyRef.current) return;

      if (saveStatus === 'saving' || saveStatus === 'pending') return;

      try {

        const res = await fetch(`/api/engagements/${eng.id}/board-resolution/status`, {

          credentials: 'include',

        });

        const body = (await res.json()) as {

          ok?: boolean;

          needsTemplateRefresh?: boolean;

          templateFingerprint?: string;

          rootSourceNewerThanTemplate?: boolean;

        };

        if (!res.ok || !body.ok || !body.needsTemplateRefresh) return;

        templateRefreshInFlightRef.current = true;

        const generated = await requestGenerate({ forceTemplateRefresh: true, overrides: mergeOverrides });

        setDoc(generated);

        contentDirtyRef.current = false;

        setPendingContent(null);

        setSaveStatus('saved');

        reloadPreviewFromDoc(generated);

        if (body.rootSourceNewerThanTemplate) {

          toastError(

            'Template source is newer than deployed file',

            'Run node scripts/prepare-board-resolution-docx.mjs, restart dev, then apply the latest template.',

          );

        } else if (

          body.templateFingerprint &&

          templateRefreshToastRef.current !== body.templateFingerprint

        ) {

          templateRefreshToastRef.current = body.templateFingerprint;

          toastSuccess('Document updated from latest template');

        }

      } catch {

        // User can still re-generate manually.

      } finally {

        templateRefreshInFlightRef.current = false;

      }

    },

    [eng?.id, requestGenerate, saveStatus, reloadPreviewFromDoc, mergeOverrides],

  );

  useEffect(() => {

    if (loading || !doc) return;

    void checkAndRefreshTemplate(doc);

  }, [loading, doc, checkAndRefreshTemplate]);

  useEffect(() => {

    if (!eng?.id) return;

    const onFocus = () => {

      if (loading || !doc || doc.status === 'finalized') return;

      void checkAndRefreshTemplate(doc);

    };

    window.addEventListener('focus', onFocus);

    return () => window.removeEventListener('focus', onFocus);

  }, [eng?.id, loading, doc, checkAndRefreshTemplate]);

  const persistContentAndRegenerate = useCallback(

    async (content: string): Promise<BoardResolutionDoc | null> => {

      if (!eng?.id || isFinalized) return null;

      setSaveStatus('saving');

      try {

        const generated = await requestGenerate({
          content,
          overrides: Object.keys(mergeOverrides).length > 0 ? mergeOverrides : undefined,
        });

        setDoc(generated);

        contentDirtyRef.current = false;

        setPendingContent(null);

        setSaveStatus('saved');

        return generated;

      } catch (err) {

        setSaveStatus('error');

        showBoardResolutionFailure(err, 'Could not save changes', setGenerateError);

        return null;

      }

    },

    [eng?.id, isFinalized, requestGenerate, mergeOverrides],

  );

  const handleDocumentChange = useCallback(

    (content: string) => {

      if (isFinalized) return;

      contentDirtyRef.current = true;

      setPendingContent(content);

      setSaveStatus('pending');

      const baseFields = buildBoardResolutionMergeFields({ engagement: eng, pre1: pre1Responses });
      let plainText = content;
      if (content.trim().startsWith('{"br":')) {
        try {
          const parsed = JSON.parse(content) as { paragraphs?: Array<{ text?: string }> };
          plainText = parsed.paragraphs?.map((paragraph) => paragraph.text ?? '').join('\n') ?? content;
        } catch {
          plainText = content;
        }
      }

      setMergeOverrides((prev) => {
        const fields = { ...baseFields, ...prev };
        const inlineOverrides = extractBoardResolutionInlineOverrides(plainText, fields);
        if (Object.keys(inlineOverrides).length === 0) return prev;
        return { ...prev, ...inlineOverrides };
      });

    },

    [isFinalized, eng, pre1Responses],

  );

  useEffect(() => {

    if (!pendingContent?.trim() || isFinalized || !hasDocx) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {

      void persistContentAndRegenerate(pendingContent);

    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    };

  }, [pendingContent, isFinalized, hasDocx, persistContentAndRegenerate]);

  const downloadVersion = doc?.updatedAt ?? doc?.storagePath ?? null;

  const buildDownloadHref = useCallback(
    (version: string | null | undefined) => {
      if (!eng?.id) return '';
      const base = `/api/engagements/${eng.id}/board-resolution/download`;
      if (!version?.trim()) return base;
      return `${base}?v=${encodeURIComponent(version.trim())}`;
    },
    [eng?.id],
  );

  const downloadHref = useMemo(
    () => buildDownloadHref(downloadVersion),
    [buildDownloadHref, downloadVersion],
  );

  const signedDownloadHref = useMemo(() => {
    if (!eng?.id || !doc?.signedStoragePath?.trim()) return '';
    const base = `/api/engagements/${eng.id}/board-resolution/download-signed`;
    const version = doc.signedUploadedAt ?? doc.signedStoragePath;
    return `${base}?v=${encodeURIComponent(version.trim())}`;
  }, [eng?.id, doc?.signedStoragePath, doc?.signedUploadedAt]);

  const previewDownloadHref = useMemo(
    () => buildDownloadHref(previewBlobVersion),
    [buildDownloadHref, previewBlobVersion],
  );

  const flushPendingAutosave = useCallback(async (): Promise<BoardResolutionDoc | null> => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const content =
      pendingContent?.trim() || previewRef.current?.getDocumentContent().trim() || '';
    if (!content || !contentDirtyRef.current || isFinalized) return null;
    return persistContentAndRegenerate(content);
  }, [pendingContent, isFinalized, persistContentAndRegenerate]);

  const handleManualSave = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const content =
      pendingContent?.trim() || previewRef.current?.getDocumentContent().trim() || '';
    if (!content?.trim()) {
      toastError('Nothing to save', 'Edit the document in the preview first.');
      return;
    }
    const saved = await persistContentAndRegenerate(content);
    if (saved) {
      toastSuccess('Changes saved', 'Board resolution draft saved to storage.');
    }
  }, [pendingContent, persistContentAndRegenerate]);

  const generateErrorDisplay = useMemo(
    () => (generateError ? formatBoardResolutionErrorDisplay(generateError) : null),
    [generateError],
  );

  const pre1StepHref = eng ? internEngagementStepPath(eng, 'pre-1') : '';

  const saveStatusText = saveStatusLabel(saveStatus);

  const applyLatestTemplate = useCallback(async () => {

    setBusy('apply-template');

    try {

      const generated = await requestGenerate({ forceTemplateRefresh: true, overrides: mergeOverrides });

      setDoc(generated);

      contentDirtyRef.current = false;

      setPendingContent(null);

      setSaveStatus('saved');

      reloadPreviewFromDoc(generated);

      setPreviewError(null);

      toastSuccess(

        isFinalized ? 'Stored file repaired' : 'Latest template applied',

        isFinalized
          ? 'The finalized Word file was rebuilt from the latest template. Client release status is unchanged.'
          : 'The stored Word file was rebuilt from public/templates/boardResolution.docx.',

      );

    } catch (err) {

      showBoardResolutionFailure(err, 'Could not apply latest template', setGenerateError);

    } finally {

      setBusy(null);

    }

  }, [isFinalized, mergeOverrides, requestGenerate, reloadPreviewFromDoc, setGenerateError]);

  const handleGenerate = useCallback(async () => {

    setBusy('generate');

    try {

      const generated = await requestGenerate({ forceTemplateRefresh: true, overrides: mergeOverrides });

      setDoc(generated);

      contentDirtyRef.current = false;

      setPendingContent(null);

      setSaveStatus('saved');

      reloadPreviewFromDoc(generated);

      setPreviewError(null);

      toastSuccess(

        isFinalized ? 'Stored file rebuilt from Pre-1' : 'Word document generated',

        isFinalized
          ? 'The finalized Word file was regenerated from Step 1 data.'
          : 'Pre-1 data merged into the latest board resolution template (.docx).',

      );

    } catch (err) {

      showBoardResolutionFailure(err, 'Could not generate document', setGenerateError);

    } finally {

      setBusy(null);

    }

  }, [isFinalized, mergeOverrides, requestGenerate, reloadPreviewFromDoc, setGenerateError]);

  const handleFinalize = useCallback(async () => {


    setBusy('finalize');

    try {

      const flushedDoc = await flushPendingAutosave();

      let nextDoc = flushedDoc ?? doc;

      if (!nextDoc?.storagePath?.trim()) {

        nextDoc = await requestGenerate();

        setDoc(nextDoc);

      }

      const nextStoragePath = nextDoc?.storagePath?.trim();

      if (!nextStoragePath) {

        throw new Error('docx_required');

      }

      const latestContent =

        previewRef.current?.getDocumentContent().trim() ||

        pendingContent?.trim() ||

        doc?.content?.trim() ||

        '';

      if (latestContent && nextDoc.status !== 'finalized') {

        await saveBoardResolutionDraftInDb(eng.id,

          latestContent,

          nextStoragePath,

        );

      }

      const saved = await finalizeBoardResolutionInDb(eng.id);

      setDoc(saved);

      reloadPreviewFromDoc(saved);

      setFinalizeOpen(false);

      void refreshEngagementChecklist(eng.id);

      toastSuccess(

        'Board resolution finalized',

        'The client can now view this document in their portal.',

      );

    } catch (err) {

      if (err instanceof Error && err.message === 'docx_required') {

        toastError('Could not finalize', 'Generate the Word document first, then finalize.');

        return;

      }

      showBoardResolutionFailure(err, 'Could not finalize', setGenerateError);

    } finally {

      setBusy(null);

    }

  }, [
    eng,
    flushPendingAutosave,
    doc,
    pendingContent,
    requestGenerate,
    reloadPreviewFromDoc,
    refreshEngagementChecklist,
    setGenerateError,
  ]);

  return {
    BOARD_RESOLUTION_DOCX_FILENAME,
    applyLatestTemplate,
    busy,
    doc,
    downloadHref,
    eng,
    finalizeOpen,
    generateError,
    generateErrorDisplay,
    handleCorruptionAutoRepair,
    handleDocumentChange,
    handleFinalize,
    handleGenerate,
    handleManualSave,
    hasDocx,
    hasPre1Data,
    internBoardResolutionPath,
    isFinalized,
    loading,
    mergeFields,
    pre1StepHref,
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
    signedDownloadHref,
  };
}
