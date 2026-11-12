import { getIncorporationPhases, type ChecklistItem } from '@/data/checklist';
import { orderByMcaSection } from '@/lib/checklist/part-b-sections';
import { CLIENT_RESPONSE_FIELDS, type ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { expandRepeatFields, repeatFieldLabel } from '@/lib/checklist/checklist-repeat';
import type { DocPackItem } from '@/lib/doc-pack/types';
import { fileNamePart, standardDownloadName } from '@/lib/files/download-name';

/**
 * "Download documents" (CR-2026-11, staff only): every document of one engagement, sorted into
 * the folders the pop-up shows and the ZIP keeps.
 *
 *   01_SPICe-Part-A         the board resolution, then each Phase 1 step that holds uploads
 *   02_SPICe-Part-B         constitution (MOA, AOA, sheets), one folder per director,
 *                           declarations, then each Phase 2 step that holds uploads
 *   03_After-Incorporation  each Phase 3 and Phase 4 step that holds uploads
 *   04_Project-Records      the answers, directors, subscribers and audit log (Excel, PR-02)
 *
 * This file is pure: it reads the document pack summary and `checklist_state`, never the
 * database or S3. The caller (`bundle.ts`) has already scoped both by the person's role, so the
 * catalog can never list what the person cannot see. Storage paths stay on the server: the
 * pop-up gets the tree from `publicCatalog`, which drops them.
 */

export type DownloadSource =
  | { type: 'pack'; itemKey: string }
  | { type: 'br-signed'; path: string }
  | { type: 'upload'; path: string }
  /** PR-02's project records, made as Excel files when downloaded. */
  | { type: 'record'; record: ProjectRecord };

export type ProjectRecord = 'answers' | 'directors' | 'subscribers' | 'audit';

const PROJECT_RECORDS: Array<{ record: ProjectRecord; label: string; name: string }> = [
  { record: 'answers', label: 'Answers to every step', name: 'Answers' },
  { record: 'directors', label: 'Proposed directors', name: 'Directors' },
  { record: 'subscribers', label: 'Subscribers', name: 'Subscribers' },
  { record: 'audit', label: 'Audit log', name: 'Audit Log' },
];

export interface DownloadFile {
  /** Stable key the pop-up sends back: `pack:<itemKey>`, `br-signed`, `upload:<step>:<field>`. */
  key: string;
  label: string;
  /** GL-08 name of the file, inside the ZIP and as a single download. */
  fileName: string;
  kind: 'generated' | 'uploaded';
  /** False for a generated document that still needs inputs or a release. */
  ready: boolean;
  /** Why it is not ready, for the greyed row. */
  reason?: string;
  source: DownloadSource;
}

export interface DownloadGroup {
  /** Stable across engagements (except the per-director ids), so a remembered choice still fits. */
  id: string;
  label: string;
  /** Folder name in the ZIP. */
  folder: string;
  /** The document name a ZIP of only this group carries ("SPICe+ Part B"). */
  zipLabel: string;
  groups: DownloadGroup[];
  files: DownloadFile[];
}

export interface DownloadCatalog {
  companyName: string;
  root: DownloadGroup;
}

type StepState = Record<string, { responses?: ChecklistItemResponses } | undefined>;

export interface CatalogInput {
  companyName: string;
  /** The document pack summary items (`evaluateDocPack`). */
  packItems: DocPackItem[];
  /** The GL-08 name a pack item downloads as (`docPackItemFilename`). */
  packFileName: (item: DocPackItem) => string;
  /** The signed board resolution on the board resolution row, if one is stored. */
  signedBoardResolutionPath?: string | null;
  state: StepState | null | undefined;
}

const CONSTITUTION_DOCS = new Set(['moa', 'aoa', 'moa-subscription-sheet', 'aoa-subscription-sheet']);

function group(id: string, label: string, folder: string, zipLabel = label): DownloadGroup {
  return { id, label, folder, zipLabel, groups: [], files: [] };
}

function numbered(index: number, label: string): string {
  return `${String(index + 1).padStart(2, '0')}_${fileNamePart(label)}`;
}

/** A field label as a file name part: the hint in brackets goes ("utility bills (not older…)"). */
function shortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || label;
}

function extensionOf(path: string): string {
  const base = path.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : 'pdf';
}

function packFile(item: DocPackItem, input: CatalogInput): DownloadFile {
  const ready = item.status === 'ready';
  const reason = ready
    ? undefined
    : item.blockedBy?.label ?? (item.missing.length ? `Needs ${item.missing.length} more ${item.missing.length === 1 ? 'answer' : 'answers'}` : 'Not ready yet');
  return {
    key: `pack:${item.key}`,
    label: item.directorName && item.audience !== 'company' ? `${item.label} — ${item.directorName}` : item.label,
    fileName: input.packFileName(item),
    kind: 'generated',
    ready,
    ...(reason ? { reason } : {}),
    source: { type: 'pack', itemKey: item.key },
  };
}

/** Every uploaded file on one step, labelled from its field. Links (http…) are not files. */
function stepUploads(item: ChecklistItem, state: StepState, companyName: string): DownloadFile[] {
  const responses = state[item.id]?.responses ?? {};
  const fields = CLIENT_RESPONSE_FIELDS[item.id] ?? [];
  const out: DownloadFile[] = [];
  for (const field of expandRepeatFields(fields, responses)) {
    if (field.type !== 'file') continue;
    const path = responses[field.id]?.trim();
    if (!path || /^https?:/i.test(path)) continue;
    const label = repeatFieldLabel(fields, responses, field.id) ?? field.label;
    out.push({
      key: `upload:${item.id}:${field.id}`,
      label,
      fileName: standardDownloadName(shortLabel(label), companyName, extensionOf(path)),
      kind: 'uploaded',
      ready: true,
      source: { type: 'upload', path },
    });
  }
  return out;
}

function addStepGroups(parent: DownloadGroup, items: ChecklistItem[], state: StepState, companyName: string): void {
  for (const item of items) {
    const files = stepUploads(item, state, companyName);
    if (files.length === 0) continue;
    const g = group(`${parent.id}/step:${item.id}`, item.title, numbered(parent.groups.length, item.title));
    g.files = files;
    parent.groups.push(g);
  }
}

export function buildDownloadCatalog(input: CatalogInput): DownloadCatalog {
  const state = input.state ?? {};
  const phases = getIncorporationPhases();
  const phaseItems = (ids: string[]) => phases.filter((p) => ids.includes(p.id)).flatMap((p) => p.items);
  const root = group('all', 'All documents', '', 'Project');

  // Part A: the board resolution, then the Phase 1 uploads.
  const partA = group('part-a', 'SPICe+ Part A', '01_SPICe-Part-A', 'SPICe Part A');
  const br = group('part-a/board-resolution', 'Board resolution', numbered(0, 'Board resolution'));
  br.files = input.packItems.filter((i) => i.part === 'part-a').map((i) => packFile(i, input));
  const signed = input.signedBoardResolutionPath?.trim();
  if (signed) {
    br.files.push({
      key: 'br-signed',
      label: 'Signed board resolution',
      fileName: standardDownloadName('Board Resolution Signed', input.companyName, extensionOf(signed)),
      kind: 'uploaded',
      ready: true,
      source: { type: 'br-signed', path: signed },
    });
  }
  if (br.files.length) partA.groups.push(br);
  addStepGroups(partA, phaseItems(['pre-inc-phase-1']), state, input.companyName);

  // Part B: the generated documents by MCA purpose, one folder per director, then the uploads.
  const partB = group('part-b', 'SPICe+ Part B', '02_SPICe-Part-B', 'SPICe Part B');
  const partBItems = input.packItems.filter((i) => i.part === 'part-b');
  const constitution = group('part-b/constitution', 'Constitution (MOA, AOA, subscription sheets)', '');
  const directors = group('part-b/directors', 'Directors', '');
  const declarations = group('part-b/declarations', 'Declarations and letters', '');
  const byDirector = new Map<string, DownloadGroup>();
  for (const item of partBItems) {
    if (item.audience !== 'company') {
      let d = byDirector.get(item.audience);
      if (!d) {
        // `directorIndex` counts from 1, as the director cards do.
        const n = item.directorIndex ?? byDirector.size + 1;
        const name = item.directorName?.trim() || `Director ${n}`;
        d = group(`part-b/directors/${item.audience}`, `Director ${n} – ${name}`, `Director-${n}_${fileNamePart(name)}`, `${name} Documents`);
        byDirector.set(item.audience, d);
        directors.groups.push(d);
      }
      d.files.push(packFile(item, input));
    } else if (CONSTITUTION_DOCS.has(item.docId)) {
      constitution.files.push(packFile(item, input));
    } else {
      declarations.files.push(packFile(item, input));
    }
  }
  for (const g of [constitution, directors, declarations]) {
    if (g.files.length || g.groups.length) {
      g.folder = numbered(partB.groups.length, g.id === constitution.id ? 'Constitution' : g.label);
      partB.groups.push(g);
    }
  }
  // SB-01: the Part B step folders follow the MCA form order (3A, 4, 5–6, 7).
  addStepGroups(partB, orderByMcaSection(phaseItems(['pre-inc-phase-2']), (i) => i.id), state, input.companyName);

  // After incorporation: the Phase 3 and Phase 4 uploads.
  const after = group('after', 'After incorporation', '03_After-Incorporation');
  addStepGroups(after, phaseItems(['post-inc-phase-3', 'registration-phase-4']), state, input.companyName);

  // Project records: the PR-02 spreadsheets, so the pop-up covers the whole project ZIP.
  const records = group('records', 'Project records (Excel)', '04_Project-Records', 'Project Records');
  records.files = PROJECT_RECORDS.map(({ record, label, name }) => ({
    key: `record:${record}`,
    label,
    fileName: standardDownloadName(name, input.companyName, 'xlsx'),
    kind: 'generated' as const,
    ready: true,
    source: { type: 'record' as const, record },
  }));

  root.groups = [partA, partB, after, records].filter((g) => g.groups.length || g.files.length);
  return { companyName: input.companyName, root };
}

/** Every file in a group and its sub-groups, in tree order. */
export function filesIn(g: DownloadGroup): DownloadFile[] {
  return [...g.files, ...g.groups.flatMap(filesIn)];
}

export interface PickedFile {
  file: DownloadFile;
  /** Folders from the top of the ZIP down to the file. */
  folders: string[];
}

/** The ready files among `keys`, with their folders. Unknown or not-ready keys are dropped. */
export function pickFiles(catalog: DownloadCatalog, keys: readonly string[]): PickedFile[] {
  const wanted = new Set(keys);
  const out: PickedFile[] = [];
  const walk = (g: DownloadGroup, folders: string[]) => {
    for (const file of g.files) if (file.ready && wanted.has(file.key)) out.push({ file, folders });
    for (const sub of g.groups) walk(sub, sub.folder ? [...folders, sub.folder] : folders);
  };
  walk(catalog.root, []);
  return out;
}

/** The smallest group that holds every picked file, to name the ZIP after it. */
export function bundleZipName(catalog: DownloadCatalog, keys: readonly string[], on?: Date): string {
  const wanted = new Set(keys);
  let best: DownloadGroup = catalog.root;
  const visit = (g: DownloadGroup): void => {
    for (const sub of g.groups) {
      const inside = new Set(filesIn(sub).map((f) => f.key));
      if ([...wanted].every((k) => inside.has(k))) {
        best = sub;
        visit(sub);
        return;
      }
    }
  };
  visit(catalog.root);
  return standardDownloadName(best.zipLabel, catalog.companyName, 'zip', on);
}

export type PublicDownloadFile = Omit<DownloadFile, 'source'>;
export interface PublicDownloadGroup extends Omit<DownloadGroup, 'groups' | 'files' | 'folder'> {
  groups: PublicDownloadGroup[];
  files: PublicDownloadFile[];
}

/** The tree as the pop-up gets it: no storage paths. */
export function publicCatalog(catalog: DownloadCatalog): { companyName: string; root: PublicDownloadGroup } {
  const strip = (g: DownloadGroup): PublicDownloadGroup => ({
    id: g.id,
    label: g.label,
    zipLabel: g.zipLabel,
    groups: g.groups.map(strip),
    files: g.files.map(({ source: _source, ...rest }) => rest),
  });
  return { companyName: catalog.companyName, root: strip(catalog.root) };
}
