'use client';

/**
 * Shared document viewer overlay (prototype v7x_doc_viewer, route `doc-viewer`).
 * CONTRACT used by every page (Home, Documents, Incorporation, Compliances,
 * Credentials): open it with a list of documents and the index to show.
 * Implementation: owned by the Documents builder (milestone M4).
 */
export interface ViewerDoc {
  /** Stable id (document id, `step:field`, filing proof id…). */
  id: string;
  name: string;
  /** Lazily resolves a short-lived URL (signed S3 URL) for preview/download. */
  url: () => Promise<string>;
  contentType?: string | null;
  sizeBytes?: number | null;
  /** "Step 7 · Registered Office Address", "GSTR-3B · Sep 2026"… */
  meta?: string;
  /** Status chip text + tone, e.g. ["Final", "ok"]. */
  chip?: { text: string; tone: 'ok' | 'due' | 'over' | 'prog' | 'up' | 'violet' };
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface DocViewerProps {
  docs: ViewerDoc[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}

export function DocViewer(_props: DocViewerProps) {
  return null;
}
