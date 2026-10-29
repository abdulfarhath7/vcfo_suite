import { isMilestoneStoragePath } from '@/lib/documents/milestone-document-storage';
import type { IndexedDocumentRow, VaultDocument, VaultEntityGroup } from '@/lib/documents/vault-documents';
import type { VaultTreeView } from '@/views/vault/vault-tree';

/*
 * Pure helpers for the vault's ZIP, preview and review actions (G-26). They turn a vault row
 * into the reference the routes take, so the page and the tests share one rule.
 */

/** `/api/documents` rows carry the review fields beside the ones the tree reads. */
export type VaultIndexRow = IndexedDocumentRow & {
  contentType?: string | null;
  sizeBytes?: number | null;
  uploadedBy?: string | null;
  reviewStatus?: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
};

export type ReviewStatus = 'none' | 'pending' | 'approved' | 'changes';

/** A vault file's index row, if it has one: its own id, or a row for the same object. */
export function indexRowFor(doc: VaultDocument, byKey: Map<string, VaultIndexRow>, byId: Map<string, VaultIndexRow>) {
  if (doc.documentId) return byId.get(doc.documentId) ?? null;
  return byKey.get(doc.storagePath.trim()) ?? null;
}

export function indexMaps(rows: VaultIndexRow[]) {
  return {
    byKey: new Map(rows.map((r) => [r.objectKey.trim(), r])),
    byId: new Map(rows.map((r) => [r.id, r])),
  };
}

/** What the ZIP and preview routes take for one file. */
export type VaultRef = { documentId: string } | { path: string } | { requestFileId: string };

/**
 * The reference for a vault file: its index row when it has one, otherwise a checklist upload's
 * storage path. Both routes check the step's release, so the two agree on who may read it.
 */
export function refFor(doc: VaultDocument, indexId?: string | null): VaultRef | null {
  const id = doc.documentId ?? indexId;
  if (id) return { documentId: id };
  if (isMilestoneStoragePath(doc.storagePath)) return { path: doc.storagePath.trim() };
  return null;
}

/** Same-origin preview (inline) or download URL for a reference. */
export function fileUrl(ref: VaultRef, mode: 'inline' | 'download' = 'inline'): string {
  const dl = mode === 'download' ? 'download=1' : '';
  if ('documentId' in ref) {
    return `/api/documents/${encodeURIComponent(ref.documentId)}/preview${dl ? `?${dl}` : ''}`;
  }
  const q = 'path' in ref ? `path=${encodeURIComponent(ref.path)}` : `requestFileId=${encodeURIComponent(ref.requestFileId)}`;
  return `/api/documents/preview?${q}${dl ? `&${dl}` : ''}`;
}

/** How the preview pane shows a file: in a frame, as an image, or not at all. */
export function previewKind(fileName: string, contentType?: string | null): 'pdf' | 'image' | null {
  const type = (contentType ?? '').toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (/^image\/(png|jpeg|webp|gif)$/.test(type) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  return null;
}

/** The folder a file sits in inside the archive: phase, then step. */
export function zipFolderFor(doc: VaultDocument): string {
  return [doc.bucket, doc.milestoneTitle].filter(Boolean).join('/');
}

/** The files under one tree folder (a phase, a step or a category), in tree order. */
export function folderDocs(entity: VaultEntityGroup, view: VaultTreeView, folderId: string): VaultDocument[] {
  if (view === 'cat') {
    const section = folderId.startsWith('cat:') ? folderId.slice(4) : '';
    return entity.milestones.flatMap((m) => m.sections.filter((s) => s.section === section).flatMap((s) => s.docs));
  }
  for (const phase of entity.phases ?? []) {
    const phaseId = `phase:${phase.phaseKey}`;
    if (folderId === phaseId) return phase.milestones.flatMap((m) => m.sections.flatMap((s) => s.docs));
    for (const milestone of phase.milestones) {
      if (folderId === `${phaseId}:${milestone.milestoneId}`) return milestone.sections.flatMap((s) => s.docs);
    }
  }
  return [];
}

/** Every file of one client. */
export function entityDocs(entity: VaultEntityGroup): VaultDocument[] {
  return entity.milestones.flatMap((m) => m.sections.flatMap((s) => s.docs));
}

/** ZIP items for a list of vault files; files the routes cannot name are left out. */
export function zipItems(
  docs: VaultDocument[],
  indexIdFor: (doc: VaultDocument) => string | null | undefined,
): Array<VaultRef & { folder: string }> {
  const seen = new Set<string>();
  const out: Array<VaultRef & { folder: string }> = [];
  for (const doc of docs) {
    const ref = refFor(doc, indexIdFor(doc));
    if (!ref) continue;
    const key = JSON.stringify(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...ref, folder: zipFolderFor(doc) });
  }
  return out;
}

/** The status word for a review state, for the chip. */
export function reviewWord(status: string | null | undefined): string | null {
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'In review';
  if (status === 'changes') return 'Sent back';
  return null;
}
