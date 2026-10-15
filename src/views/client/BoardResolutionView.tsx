'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, FileText, Upload } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { EmptyStateIllustrated } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import { findEngagementForClientUser } from '@/lib/checklist-state-key';
import { buildBoardResolutionMergeFields, type BoardResolutionDoc } from '@/lib/board-resolution';
import {
  BOARD_RESOLUTION_DOCX_FILENAME,
  uploadSignedBoardResolution,
  validateSignedBoardResolutionFile,
} from '@/lib/board-resolution-storage';
import { maxUploadSizeLabel } from '@/lib/upload-limits';
import {
  fetchBoardResolutionInDb,
} from '@/lib/engagements-db';
import { useRealtimeBoardResolution } from '@/hooks/use-realtime-board-resolution';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

export default function BoardResolutionView() {
  const { user, engagements, getStateForEngagement, refreshEngagementChecklist } = useApp();
  const engagement = useMemo(
    () => (user ? findEngagementForClientUser(engagements, user) : undefined),
    [engagements, user],
  );

  const pre1Item = useMemo(() => checklist.find((c) => c.id === 'pre-1'), []);
  const pre1Responses = useMemo(() => {
    if (!engagement || !pre1Item) return {};
    const state = getStateForEngagement(engagement);
    return extractItemResponses(pre1Item, state['pre-1']);
  }, [engagement, pre1Item, getStateForEngagement]);

  const mergeFields = useMemo(
    () =>
      engagement
        ? buildBoardResolutionMergeFields({ engagement, pre1: pre1Responses })
        : undefined,
    [engagement, pre1Responses],
  );

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<BoardResolutionDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!engagement?.id) return;
    void refreshEngagementChecklist(engagement.id);
  }, [engagement?.id, refreshEngagementChecklist]);

  const loadDoc = useCallback(async (opts?: { silent?: boolean }) => {
    if (!engagement?.id) {
      if (!opts?.silent) setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const row = await fetchBoardResolutionInDb(engagement.id);
      setDoc(row);
    } catch (err) {
      if (!opts?.silent) {
        toastError('Could not load document', errorMessage(err, 'Try again later.'));
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [engagement?.id]);

  useEffect(() => {
    void loadDoc();
  }, [loadDoc]);

  useRealtimeBoardResolution({
    appEngagementId: engagement?.id,
    onRemoteChange: () => {
      void loadDoc({ silent: true });
    },
  });

  const downloadHref = useMemo(() => {
    if (!engagement?.id) return '';
    const base = `/api/engagements/${engagement.id}/board-resolution/download`;
    const version = doc?.updatedAt ?? doc?.storagePath;
    if (!version?.trim()) return base;
    return `${base}?v=${encodeURIComponent(version.trim())}`;
  }, [engagement?.id, doc?.updatedAt, doc?.storagePath]);

  const signedDownloadHref = useMemo(() => {
    if (!engagement?.id || !doc?.signedStoragePath?.trim()) return '';
    const base = `/api/engagements/${engagement.id}/board-resolution/download-signed`;
    const version = doc.signedUploadedAt ?? doc.signedStoragePath;
    return `${base}?v=${encodeURIComponent(version.trim())}`;
  }, [engagement?.id, doc?.signedStoragePath, doc?.signedUploadedAt]);

  const handleSignedUpload = async (file: File) => {
    if (!engagement?.id) return;

    const validationErr = validateSignedBoardResolutionFile(file);
    if (validationErr) {
      toastError(validationErr);
      return;
    }

    setUploading(true);
    try {
      // One request: the route writes the object AND records it, so there is
      // no orphaned-upload window to clean up afterwards.
      const body = await uploadSignedBoardResolution(engagement.id, file);
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              signedUploadedAt: body.signedUploadedAt ?? prev.signedUploadedAt,
              signedStoragePath: body.signedStoragePath ?? prev.signedStoragePath,
            }
          : prev,
      );
      toastSuccess(
        'Signed copy uploaded',
        'Your engagement team can now download the signed board resolution.',
      );
    } catch (err) {
      toastError(
        'Upload failed',
        errorMessage(err, `Use a PDF or Word file under ${maxUploadSizeLabel()}.`),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!engagement) return null;

  const hasDocx = Boolean(doc?.storagePath?.trim());
  const visible = doc?.status === 'finalized' && hasDocx;
  const finalizedWithoutDocx = doc?.status === 'finalized' && !hasDocx;

  return (
    <PageTransition>
      <SEO
        title="Board Resolution — VCFO Suite"
        description="Certified board resolution authorizing your India subsidiary incorporation."
        path="/app/client/board-resolution"
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/app/client/overview"
            className="-ml-1.5 inline-flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-[13px] font-medium text-muted-foreground hover:bg-primary-light hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Back to home
          </Link>
          <h1 className="min-w-0 truncate text-[20px] font-semibold tracking-tight text-foreground">Board resolution</h1>
        </div>
        <p className="truncate text-[13px] text-muted-foreground">{engagement.companyName}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-text-tertiary py-8">
          <HexgridLoader size="sm" />
          Loading…
        </div>
      ) : visible ? (
        <article className="overflow-hidden border border-border bg-panel print:border-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 print:hidden">
            <p className="mr-auto text-[12.5px] font-semibold text-foreground">Certified true copy</p>
            <a
              href={downloadHref}
              download={BOARD_RESOLUTION_DOCX_FILENAME}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-foreground px-3 text-[13px] font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Download className="w-4 h-4" />
              Download Word document (.docx)
            </a>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              aria-label="Upload signed board resolution"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleSignedUpload(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              className="h-8 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {uploading
                ? 'Uploading…'
                : doc.signedStoragePath
                  ? 'Replace signed copy'
                  : 'Upload signed board resolution'}
            </Button>

            {doc.signedStoragePath && signedDownloadHref && (
              <a
                href={signedDownloadHref}
                className="text-[13px] text-brand hover:underline"
              >
                Download your signed copy
              </a>
            )}
          </div>

          <div className="bg-muted/40 px-4 py-6 sm:px-10 print:bg-transparent print:p-0">
            <BoardResolutionDocPreview
              engagementId={engagement.id}
              downloadUrl={downloadHref}
              refreshKey={`${doc.storagePath ?? ''}:${doc.updatedAt ?? ''}`}
              mergeFields={mergeFields}
            />
          </div>

          {(doc.signedUploadedAt || doc.finalizedAt) && (
            <p className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground print:hidden">
              {doc.finalizedAt
                ? `Released ${new Date(doc.finalizedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}`
                : null}
              {doc.finalizedAt && doc.signedUploadedAt ? ' · ' : null}
              {doc.signedUploadedAt
                ? `Signed copy uploaded ${new Date(doc.signedUploadedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}`
                : null}
            </p>
          )}
        </article>
      ) : finalizedWithoutDocx ? (
        <EmptyStateIllustrated
          icon={FileText}
          title="Document not generated yet"
          actionLabel="Back to incorporation"
          onAction={() => window.location.assign('/app/client/incorporation')}
        />
      ) : (
        <EmptyStateIllustrated
          icon={FileText}
          title="Not available yet"
          actionLabel="Back to incorporation"
          onAction={() => window.location.assign('/app/client/incorporation')}
        />
      )}
    </PageTransition>
  );
}
