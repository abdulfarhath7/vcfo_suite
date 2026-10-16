/**
 * Documents page view-model: the prototype's flat node list
 * (`[id, parent, label, type, status, …]`, docs_a_refined.dc.html:260-287)
 * built from the real `DocNode`s and the shared step model.
 */
import type { CSSProperties } from 'react';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { DOC_CATEGORIES, OTHER_PHASE_ID, OTHER_PHASE_TITLE, type DocNode, type DocStatus } from '@/lib/client-portal/documents';
import { fileTag, longDate, dayMonth, TAG_STYLE, TAG_TIP, type FileTag } from './file-types';

export type View = 0 | 1; // 0 = By step, 1 = By category

export interface TFolder {
  kind: 'folder';
  id: string;
  parent: string | null;
  label: string;
  level: 'phase' | 'step' | 'cat';
  stepId?: string;
  phaseId?: string;
  /** Zip folder key for the API. */
  zipKey: string;
}

export interface TFile {
  kind: 'file';
  id: string;
  parent: string;
  node: DocNode;
}

export type TEntry = TFolder | TFile;

export const OTHER_STEP_ID = 'other-files';

export function buildEntries(nodes: DocNode[], model: PortalIncorporationModel, view: View): TEntry[] {
  const out: TEntry[] = [];
  const order = (list: DocNode[]) => [...list.filter((n) => n.status !== 'Missing'), ...list.filter((n) => n.status === 'Missing')];
  if (view === 1) {
    for (const c of DOC_CATEGORIES) {
      const files = order(nodes.filter((n) => n.categoryId === c.id));
      if (!files.length) continue;
      out.push({ kind: 'folder', id: `c:${c.id}`, parent: null, label: c.name, level: 'cat', zipKey: `cat:${c.id}` });
      for (const f of files) out.push({ kind: 'file', id: f.id, parent: `c:${c.id}`, node: f });
    }
    return out;
  }
  const byStep = new Map<string, DocNode[]>();
  const other: DocNode[] = [];
  for (const n of nodes) {
    if (n.stepId && model.byId[n.stepId]) {
      const list = byStep.get(n.stepId) ?? [];
      list.push(n);
      byStep.set(n.stepId, list);
    } else other.push(n);
  }
  for (const phase of model.phases) {
    const steps = phase.steps.filter((s) => byStep.has(s.id));
    if (!steps.length) continue;
    const pid = `p:${phase.id}`;
    out.push({ kind: 'folder', id: pid, parent: null, label: phase.title, level: 'phase', phaseId: phase.id, zipKey: `phase:${phase.id}` });
    for (const s of steps) {
      const sid = `s:${s.id}`;
      out.push({ kind: 'folder', id: sid, parent: pid, label: `${s.n} · ${s.title}`, level: 'step', stepId: s.id, phaseId: phase.id, zipKey: `step:${s.id}` });
      for (const f of order(byStep.get(s.id)!)) out.push({ kind: 'file', id: f.id, parent: sid, node: f });
    }
  }
  if (other.length) {
    const pid = `p:${OTHER_PHASE_ID}`;
    out.push({ kind: 'folder', id: pid, parent: null, label: OTHER_PHASE_TITLE, level: 'phase', phaseId: OTHER_PHASE_ID, zipKey: `phase:${OTHER_PHASE_ID}` });
    const sid = `s:${OTHER_STEP_ID}`;
    out.push({ kind: 'folder', id: sid, parent: pid, label: 'Requested and shared files', level: 'step', phaseId: OTHER_PHASE_ID, zipKey: `phase:${OTHER_PHASE_ID}` });
    for (const f of order(other)) out.push({ kind: 'file', id: f.id, parent: sid, node: f });
  }
  return out;
}

export type StatusClass = 'ok' | 'rv' | 'ms' | 'x';
export function statusClass(st: DocStatus): StatusClass {
  return st === 'Approved' || st === 'Final' ? 'ok' : st === 'In review' ? 'rv' : st === 'Missing' ? 'ms' : 'x';
}

/** Prototype ST: status badge colours. */
export const STATUS_STYLE: Record<DocStatus, CSSProperties> = {
  Approved: { background: 'var(--ok-light)', color: 'var(--ok-text)' },
  Final: { background: 'var(--navy)', color: '#fff' },
  'In review': { background: 'var(--prog-light)', color: 'var(--prog-text)' },
  Replaced: { background: 'var(--raised)', color: 'var(--muted)' },
  Missing: { background: 'var(--due-chip)', color: '#fff' },
};

/** Prototype G: set-A status glyphs (rule 18). [background, fill path, stroke path] */
export const GLYPH: Record<'done' | 'sbc' | 'you' | 'late' | 'now', [CSSProperties, string, string]> = {
  done: [{ background: 'var(--ok-chip)' }, '', 'M6.5 12.5l3.8 3.8 7.2-8'],
  sbc: [{ background: 'oklch(55% 0.2 262)' }, '', 'M5.5 16l4.5-4.5 3 3 5.5-6 M14.5 8.5h4v4'],
  you: [{ background: 'var(--due-chip)' }, 'M12 4.5a3.6 3.6 0 1 1 0 7.2a3.6 3.6 0 1 1 0-7.2Z M4.8 20.5a7.2 7.2 0 0 1 14.4 0Z', ''],
  late: [{ background: 'var(--over-chip)' }, '', 'M12 6v7.5 M12 18.2v.1'],
  now: [{ background: 'var(--navy)' }, '', 'M12 6.5v6l3.5 2'],
};

export function glyphKey(n: DocNode): keyof typeof GLYPH {
  if (n.status === 'In review') return 'sbc';
  if (n.status === 'Missing') return n.overdue ? 'late' : 'you';
  return 'done';
}

export function statusTip(n: DocNode, company: string): string {
  const d = longDate(n.date);
  switch (n.status) {
    case 'Approved':
      return `Done · approved ${d}`;
    case 'Final':
      return n.fromSbc ? `Done · from SBC ${d}` : `Done · from ${company} ${d}`;
    case 'In review':
      return `With SBC · in review since ${d}`;
    case 'Missing':
      if (n.overdue) return `Late · was due ${d}`;
      return n.due ? `Waiting on ${company} · due ${d}` : `Waiting on ${company}`;
    default:
      return n.status;
  }
}

export function missingLabel(n: Pick<DocNode, 'overdue' | 'due'>): string {
  if (n.overdue) return 'Overdue';
  return n.due ? `Due ${dayMonth(n.due)}` : 'Requested';
}

export function missingStyle(n: Pick<DocNode, 'overdue'>): CSSProperties {
  return n.overdue ? { background: 'var(--over-chip)', color: '#fff' } : { background: 'var(--due-chip)', color: '#fff' };
}

export function tagOf(n: DocNode): FileTag {
  return fileTag(n.fileName, n.contentType);
}

export function tagStyle(n: DocNode): CSSProperties {
  return TAG_STYLE[tagOf(n)];
}

export function tagTip(n: DocNode): string {
  return TAG_TIP[tagOf(n)];
}

export function tagText(n: DocNode): string {
  const t = tagOf(n);
  return t === 'FILE' ? 'FILE' : t;
}

export function fileUrl(ref: string, download = false): string {
  return `/api/client/documents/file?ref=${encodeURIComponent(ref)}${download ? '&dl=1' : ''}`;
}

/** Counts for a folder's progress bar (non-replaced files under it). */
export function folderCounts(files: DocNode[]): { ok: number; rv: number; ms: number; tot: number } {
  const kids = files.filter((f) => !f.replaced);
  const ok = kids.filter((f) => statusClass(f.status) === 'ok').length;
  const rv = kids.filter((f) => statusClass(f.status) === 'rv').length;
  const ms = kids.filter((f) => statusClass(f.status) === 'ms').length;
  return { ok, rv, ms, tot: ok + rv + ms };
}

/** "6 · Director KYC" → "Director KYC". */
export function stripNo(label: string): string {
  return label.replace(/^\d+ · /, '');
}
