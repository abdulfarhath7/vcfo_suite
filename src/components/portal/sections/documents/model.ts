/**
 * Documents section view-model (pure). Turns the real `ClientDocumentsPayload`
 * (src/lib/client-portal/documents.ts) plus the shared step model into the
 * prototype's shape (a5_docs.js): phases → steps → document rows, each row
 * with one of the prototype's five states, and the filter the toolbar applies.
 */
import type { DocNode, OpenRequest } from '@/lib/client-portal/documents';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';

/** Prototype document states: ok = approved / final, review = in review, req = needed, over = overdue, rep = replaced. */
export type DocSt = 'ok' | 'review' | 'req' | 'over' | 'rep';

export const DST: Record<DocSt, ['ok' | 'up' | 'due' | 'over' | 'mut', string]> = {
  ok: ['ok', 'Approved'],
  review: ['up', 'In review'],
  req: ['due', 'Needed'],
  over: ['over', 'Overdue'],
  rep: ['mut', 'Replaced'],
};

export function docState(n: DocNode): DocSt {
  if (n.replaced || n.status === 'Replaced') return 'rep';
  if (n.status === 'Missing') return n.overdue ? 'over' : 'req';
  if (n.status === 'In review') return 'review';
  return 'ok';
}

/** Status pill text: Final stays "Final" (SBC-issued papers), the rest follows the prototype. */
export function docStateLabel(n: DocNode): string {
  const st = docState(n);
  if (st === 'ok' && n.status === 'Final') return 'Final';
  return DST[st][1];
}

/** File-type tile text (`.fi PDF|DOCX|JPG|XLSX`). */
export type FileKind = 'PDF' | 'DOCX' | 'JPG' | 'XLSX' | 'FILE';
export function fileKindOf(name: string | null | undefined, contentType?: string | null): FileKind {
  const n = (name ?? '').toLowerCase();
  const ct = (contentType ?? '').toLowerCase();
  if (/\.pdf$/.test(n) || ct === 'application/pdf') return 'PDF';
  if (/\.(xlsx?|csv)$/.test(n) || /sheet|excel/.test(ct)) return 'XLSX';
  if (/\.(docx?|rtf)$/.test(n) || /word/.test(ct)) return 'DOCX';
  if (/\.(jpe?g|png|webp|gif|heic)$/.test(n) || /^image\//.test(ct)) return 'JPG';
  return n || ct ? 'FILE' : 'PDF';
}

export type PreviewMode = 'pdf' | 'image' | 'none';
export function previewModeOf(name: string | null | undefined, contentType?: string | null): PreviewMode {
  const n = (name ?? '').toLowerCase();
  const ct = (contentType ?? '').toLowerCase();
  if (/\.pdf$/.test(n) || ct === 'application/pdf') return 'pdf';
  if (/\.(jpe?g|png|webp|gif)$/.test(n) || /^image\/(jpeg|jpg|png|webp|gif)$/.test(ct)) return 'image';
  return 'none';
}

export function sizeLabel(bytes?: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function fileUrl(ref: string, download = false): string {
  return `/api/client/documents/file?ref=${encodeURIComponent(ref)}${download ? '&dl=1' : ''}`;
}

/* ---------------------------------------------------------------- tree */

export const OTHER_PHASE = 'other';

export interface DocStepGroup {
  /** step id, or 'other-files' */
  id: string;
  /** 1-based step number (prototype `stepno`); undefined for the "other" group */
  no?: number;
  name: string;
  docs: DocNode[];
}

export interface DocPhaseGroup {
  /** phase id, or 'other' */
  id: string;
  /** "PHASE 1" / "OTHER" */
  tag: string;
  title: string;
  sub: string;
  steps: DocStepGroup[];
}

/** Phases → steps → docs, in checklist order; documents without a known step land in "Other documents". */
export function buildTree(nodes: DocNode[], model: PortalIncorporationModel): DocPhaseGroup[] {
  const byStep = new Map<string, DocNode[]>();
  const other: DocNode[] = [];
  for (const n of nodes) {
    if (n.stepId && model.byId[n.stepId]) {
      const l = byStep.get(n.stepId) ?? [];
      l.push(n);
      byStep.set(n.stepId, l);
    } else other.push(n);
  }
  const out: DocPhaseGroup[] = [];
  for (const p of model.phases) {
    const steps: DocStepGroup[] = p.steps
      .filter((s) => byStep.has(s.id))
      .map((s) => ({ id: s.id, no: s.n, name: s.title, docs: order(byStep.get(s.id)!) }));
    if (!steps.length) continue;
    out.push({ id: p.id, tag: `PHASE ${p.no}`, title: p.name, sub: p.section, steps });
  }
  if (other.length) {
    out.push({ id: OTHER_PHASE, tag: 'OTHER', title: 'Other documents', sub: 'Requested and shared files', steps: [{ id: 'other-files', name: 'Requested and shared files', docs: order(other) }] });
  }
  return out;
}

/** Current files first, then missing rows, then replaced versions. */
function order(list: DocNode[]): DocNode[] {
  const rank = (n: DocNode) => (docState(n) === 'rep' ? 2 : n.status === 'Missing' ? 1 : 0);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

/* ---------------------------------------------------------------- filter */

export type StatFilter = 'all' | 'ok' | 'review' | 'need';

export interface DocFilter {
  phase: string; // 'all' | phase id
  stat: StatFilter;
  rep: boolean;
  q: string;
}

export function matches(n: DocNode, f: DocFilter): boolean {
  const st = docState(n);
  if (!f.rep && st === 'rep') return false;
  if (f.stat !== 'all') {
    if (f.stat === 'need' ? !(st === 'req' || st === 'over') : st !== f.stat) return false;
  }
  const q = f.q.trim().toLowerCase();
  if (q && !`${n.label} ${n.fileName}`.toLowerCase().includes(q)) return false;
  return true;
}

/** Documents counted as "live": not replaced. */
export const live = (nodes: DocNode[]): DocNode[] => nodes.filter((n) => docState(n) !== 'rep');

export interface Counts {
  /** live docs */
  total: number;
  /** received: everything live that is not still needed */
  received: number;
  /** needed from the client (req + over) */
  need: number;
  ok: number;
  review: number;
}

export function counts(nodes: DocNode[]): Counts {
  const l = live(nodes);
  const need = l.filter((n) => ['req', 'over'].includes(docState(n))).length;
  return {
    total: l.length,
    received: l.length - need,
    need,
    ok: l.filter((n) => docState(n) === 'ok').length,
    review: l.filter((n) => docState(n) === 'review').length,
  };
}

/** Earlier versions of a document: replaced nodes on the same step with the same label (or same request). */
export function earlierVersions(n: DocNode, nodes: DocNode[]): DocNode[] {
  return nodes.filter((x) => x.id !== n.id && docState(x) === 'rep' && ((n.requestId && x.requestId === n.requestId) || (x.stepId === n.stepId && x.label === n.label)));
}

/** The open request a document can be re-uploaded against (SBC asked again). */
export function reuploadRequest(n: DocNode, open: OpenRequest[]): OpenRequest | undefined {
  if (n.requestId) return open.find((r) => r.id === n.requestId);
  return undefined;
}

/** "PDF · Up to 50 MB" style spec chips for an upload card. */
export function specChips(accept: { exts: string[]; maxLabel: string }, r: OpenRequest): string[] {
  const exts = accept.exts.filter((e) => e !== 'jpeg' && e !== 'doc' && e !== 'webp').map((e) => e.toUpperCase());
  const out = [exts.join(' · ') || 'PDF', `Up to ${accept.maxLabel}`];
  if (r.reupload) out.unshift('New version');
  return out;
}
