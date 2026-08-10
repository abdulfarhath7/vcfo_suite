'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSignature, FileText, Upload } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { Eyebrow, EmptyStateIllustrated } from '@/components/noir';
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
import { useRealtimeBoardResolution } from '@/lib/supabase/use-realtime-board-resolution';
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

      <PageHeader
        accent="violet"
        icon={FileSignature}
        eyebrow="Incorporation"
        title="Board Resolution"
        subtitle={engagement.companyName}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-text-tertiary py-8">
          <HexgridLoader size="sm" />
          Loading…
        </div>
      ) : visible ? (
        <article className="surface-raised p-6 md:p-8 print:shadow-none print:border-0">
          <Eyebrow className="mb-4">Certified true copy</Eyebrow>
          <p className="text-[13px] text-text-secondary mb-5 max-w-lg">
            Review your certified board resolution below. Download the Word file, sign it, then
            upload the signed copy so your engagement team can proceed.
          </p>

          <div className="mb-6 flex items-start justify-center print:hidden">
            <BoardResolutionDocPreview
              engagementId={engagement.id}
              downloadUrl={downloadHref}
              refreshKey={`${doc.storagePath ?? ''}:${doc.updatedAt ?? ''}`}
              mergeFields={mergeFields}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6 print:hidden">
            <a
              href={downloadHref}
              download={BOARD_RESOLUTION_DOCX_FILENAME}
              className="gold-sheen inline-flex items-center justify-center gap-2 rounded-md h-11 px-5 text-[14px] font-medium tracking-tight hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
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
              className="h-11 gap-2"
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

          {doc.signedUploadedAt && (
            <p className="text-[11.5px] text-success-text mb-4 print:hidden">
              Signed copy uploaded{' '}
              {new Date(doc.signedUploadedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          {doc.finalizedAt && (
            <p className="text-[11.5px] text-text-tertiary mt-6 print:hidden">
              Released{' '}
              {new Date(doc.finalizedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </article>
      ) : finalizedWithoutDocx ? (
        <EmptyStateIllustrated
          icon={FileText}
          title="Document not generated yet"
          description="Your board resolution has been marked finalized, but the Word document is not available yet. Please contact your engagement team."
          actionLabel="Back to incorporation"
          onAction={() => window.location.assign('/app/client/incorporation')}
        />
      ) : (
        <EmptyStateIllustrated
          icon={FileText}
          title="Not available yet"
          description="Your engagement team is preparing the board resolution. It will appear here once finalized."
          actionLabel="Back to incorporation"
          onAction={() => window.location.assign('/app/client/incorporation')}
        />
      )}
    </PageTransition>
  );
}
