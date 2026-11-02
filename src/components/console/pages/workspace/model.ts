/**
 * Workspace pages (Email, Document vault, Knowledge bank) — pure helpers.
 *
 * Everything here mirrors a rule of the live views it replaces:
 *   Email           src/views/staff/ComposeMail.tsx + src/components/email/*
 *   Document vault  src/views/vault/DocumentVaultPage.tsx (manager and lead)
 *   Knowledge bank  src/views/knowledge-bank/*
 * so the console pages keep the same behaviour with the prototype's look.
 */
import { fmt, fmtY, todayIso } from '@/components/portal/dates';
import { clientRecipientsForProject, type DirectoryPerson } from '@/lib/email/directory-filter';
import { knowledgeBankFileMatchesQuery } from '@/lib/knowledge-bank/knowledge-bank-search';
import type { KnowledgeBankFile, KnowledgeBankFolder } from '@/views/knowledge-bank/knowledge-bank-ui-state';

/* ================================================================ words and dates */

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "16 Oct" this year, "16 Oct 2025" otherwise, for an ISO day or timestamp (India time). */
export function dayLabel(ts: string | null | undefined, today: string = todayIso()): string {
  if (!ts) return '—';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(ts) ? ts : (() => {
    const t = new Date(ts).getTime();
    return Number.isNaN(t) ? '' : todayIso(t);
  })();
  if (!day) return '—';
  return day.slice(0, 4) === today.slice(0, 4) ? fmt(day) : fmtY(day);
}

/** "2:30 pm" in India time. */
export function timeLabel(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    .replace(/\s?(am|pm)$/i, (m) => ' ' + m.trim().toLowerCase());
}

/* ================================================================ files */

export type FileFamily = 'pdf' | 'word' | 'image' | 'sheet' | 'slides' | 'text' | 'other';

/** Lower-case extension without the dot ('' when the name has none). */
export function fileExt(name: string | null | undefined): string {
  const base = (name ?? '').split(/[/\\]/).pop() ?? '';
  const i = base.lastIndexOf('.');
  return i > 0 && i < base.length - 1 ? base.slice(i + 1).toLowerCase() : '';
}

export function fileFamily(name: string | null | undefined, contentType?: string | null): FileFamily {
  const ext = fileExt(name);
  const ct = (contentType ?? '').toLowerCase();
  if (ext === 'pdf' || ct === 'application/pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx' || ct.includes('wordprocessingml') || ct === 'application/msword') return 'word';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'svg'].includes(ext) || ct.startsWith('image/')) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext) || ct.includes('spreadsheetml') || ct === 'text/csv') return 'sheet';
  if (ext === 'ppt' || ext === 'pptx' || ct.includes('presentationml')) return 'slides';
  if (ext === 'txt' || ext === 'md' || ct === 'text/plain') return 'text';
  return 'other';
}

export const FAMILY_ORDER: FileFamily[] = ['pdf', 'word', 'image', 'sheet', 'slides', 'text', 'other'];

export const FAMILY_LABEL: Record<FileFamily, string> = {
  pdf: 'PDFs',
  word: 'Word documents',
  image: 'Photos and scans',
  sheet: 'Spreadsheets',
  slides: 'Presentations',
  text: 'Text files',
  other: 'Other files',
};

/** The type tag on a file (`.mx-ft2 <cls>`): the real extension, coloured by its family. */
export function fileTag(name: string | null | undefined, contentType?: string | null): { text: string; cls: string } {
  const fam = fileFamily(name, contentType);
  const cls = fam === 'pdf' ? 'pdf' : fam === 'word' ? 'docx' : fam === 'image' ? 'jpg' : fam === 'sheet' ? 'xlsx' : fam === 'slides' ? 'pptx' : 'file';
  return { text: fileExt(name) || (fam === 'other' ? 'file' : fam), cls };
}

export type PreviewMode = 'pdf' | 'image' | 'none';

/** What the preview can draw in the page: a PDF frame, an image, or nothing (download it instead). */
export function previewModeOf(name: string | null | undefined, contentType?: string | null): PreviewMode {
  const ext = fileExt(name);
  const ct = (contentType ?? '').toLowerCase();
  if (ext === 'pdf' || ct === 'application/pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || /^image\/(jpeg|jpg|png|webp|gif)$/.test(ct)) return 'image';
  return 'none';
}

/** Group items by file family in FAMILY_ORDER, newest first inside a group. */
export function groupByFamily<T>(
  items: T[],
  nameOf: (t: T) => string,
  dateOf: (t: T) => string | null | undefined,
): Array<{ family: FileFamily; label: string; items: T[] }> {
  const by = new Map<FileFamily, T[]>();
  for (const it of items) {
    const fam = fileFamily(nameOf(it));
    const list = by.get(fam) ?? [];
    list.push(it);
    by.set(fam, list);
  }
  return FAMILY_ORDER.flatMap((family) => {
    const list = by.get(family);
    if (!list?.length) return [];
    return [{ family, label: FAMILY_LABEL[family], items: [...list].sort((a, b) => (dateOf(b) ?? '').localeCompare(dateOf(a) ?? '')) }];
  });
}

/** Human file size ("820 KB", "2.4 MB"); '' when unknown. */
export function sizeLabel(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ================================================================ email */

export interface ComposePrefill {
  to: string | null;
  subject: string | null;
  body: string | null;
  template: string | null;
}

/**
 * The compose page's URL params, as the live ComposeMail reads them: `to` (a
 * directory person's id or email, or any address), `subject` (cut at 300),
 * `body` (cut at 5000). Today's "Send reminder" and Ask VCFO's drafts use them;
 * `template` (a template id) is the search palette's way in.
 */
export function readComposeParams(params: Pick<URLSearchParams, 'get'> | null | undefined): ComposePrefill {
  const get = (k: string) => params?.get(k) ?? null;
  const subject = get('subject');
  const body = get('body');
  const to = get('to')?.trim() || null;
  const template = get('template')?.trim() || null;
  return {
    to,
    subject: subject ? subject.slice(0, 300) : null,
    body: body ? body.slice(0, 5000) : null,
    template,
  };
}

/**
 * Picking a client in the To row (live ComposeRecipientPicker.handleClientChange):
 * the contacts the previous pick added go, the new client's contacts come in,
 * and anyone the person chose by hand stays.
 */
export function clientAutoFill(
  people: DirectoryPerson[],
  selected: ReadonlySet<string>,
  prevAuto: readonly string[],
  nextClientId: string,
): { remove: string[]; add: string[] } {
  const nextIds = clientRecipientsForProject(people, nextClientId).map((p) => p.userId);
  const manual = [...selected].filter((id) => !prevAuto.includes(id));
  const add = nextIds.filter((id) => !manual.includes(id));
  return { remove: [...prevAuto], add };
}

export function applyAutoFill(selected: ReadonlySet<string>, remove: readonly string[], add: readonly string[]): Set<string> {
  const next = new Set(selected);
  for (const id of remove) next.delete(id);
  for (const id of add) next.add(id);
  return next;
}

/** A chip in To: a directory person or a typed address. */
export type Recipient =
  | { key: string; kind: 'person'; email: string; name: string; userId: string }
  | { key: string; kind: 'email'; email: string; name: string };

/** People first (directory order), then typed addresses — the order the live page sends them in. */
export function recipientsOf(people: DirectoryPerson[], selected: ReadonlySet<string>, customEmails: readonly string[]): Recipient[] {
  return [
    ...people
      .filter((p) => selected.has(p.userId))
      .map((p): Recipient => ({ key: `person:${p.userId}`, kind: 'person', email: p.email, name: p.name, userId: p.userId })),
    ...customEmails.map((email): Recipient => ({ key: `email:${email}`, kind: 'email', email, name: email })),
  ];
}

/** Suggestions grouped as the prototype draws them: clients, then the team. */
export function groupPeople(list: DirectoryPerson[]): Array<{ label: string; people: DirectoryPerson[] }> {
  const clients = list.filter((p) => p.kind === 'client');
  const team = list.filter((p) => p.kind !== 'client');
  return [
    ...(clients.length ? [{ label: 'Clients', people: clients }] : []),
    ...(team.length ? [{ label: 'Team', people: team }] : []),
  ];
}

/** What this page sent in this browser session (newest first, a short list). */
export interface SentEntry {
  at: string;
  subject: string;
  to: string[];
  from?: string;
}

export function pushSent(list: readonly SentEntry[], entry: SentEntry, max = 6): SentEntry[] {
  return [entry, ...list].slice(0, max);
}

export function parseSent(raw: string | null | undefined): SentEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e): e is SentEntry =>
        Boolean(e) && typeof e === 'object' && typeof (e as SentEntry).at === 'string' && typeof (e as SentEntry).subject === 'string' && Array.isArray((e as SentEntry).to),
    );
  } catch {
    return [];
  }
}

/* ================================================================ knowledge bank */

/** Live KnowledgeBankPage.uploaderLabel. */
export function kbUploaderLabel(file: Pick<KnowledgeBankFile, 'uploaderName' | 'uploaderEmail'>): string {
  if (file.uploaderName?.trim()) return file.uploaderName.trim();
  if (file.uploaderEmail?.trim()) return file.uploaderEmail.trim();
  return 'Unknown';
}

/**
 * Library search, exactly as live: folders whose name holds the text (from
 * every level), files whose title, file name, description, folder path or
 * uploader holds it (from every folder).
 */
export function kbSearch(
  q: string,
  folders: readonly KnowledgeBankFolder[],
  files: readonly KnowledgeBankFile[],
): { folders: KnowledgeBankFolder[]; files: KnowledgeBankFile[] } {
  const query = q.trim().toLowerCase();
  if (!query) return { folders: [...folders], files: [...files] };
  return {
    folders: folders.filter((f) => f.name.toLowerCase().includes(query)),
    files: files.filter((f) => knowledgeBankFileMatchesQuery(f, q) || kbUploaderLabel(f).toLowerCase().includes(query)),
  };
}

/** A folder and every folder under it. */
export function kbSubtree(folderId: string, folders: readonly KnowledgeBankFolder[]): Set<string> {
  const out = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

export interface Shelf {
  id: string;
  name: string;
  /** documents on the shelf, its sub-folders included */
  files: number;
  /** sub-folders on the shelf */
  folders: number;
}

/** The top-level folders as shelves (the prototype's spines), A to Z as live lists them. */
export function kbShelves(folders: readonly KnowledgeBankFolder[], files: readonly KnowledgeBankFile[]): Shelf[] {
  return folders
    .filter((f) => f.parentId === null)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    .map((f) => {
      const ids = kbSubtree(f.id, folders);
      return {
        id: f.id,
        name: f.name,
        files: files.filter((x) => x.folderId !== null && ids.has(x.folderId)).length,
        folders: ids.size - 1,
      };
    });
}

/** The top-level folder a folder sits under (itself when it is one); null at the top of the library. */
export function kbShelfOf(folderId: string | null, folders: readonly KnowledgeBankFolder[]): string | null {
  if (!folderId) return null;
  const byId = new Map(folders.map((f) => [f.id, f]));
  const seen = new Set<string>();
  let cur = byId.get(folderId);
  if (!cur) return null;
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parentId)!;
  }
  return cur.id;
}

/**
 * A shelf's colour from its name, in the area colours the rest of the portal
 * uses (Incorporation · MCA, GST, Income tax, Payroll, FEMA; templates gold).
 * null when the name names no area — the page then uses the folder's own hue.
 */
export function shelfColor(name: string): string | null {
  const n = name.toLowerCase();
  if (/template/.test(n)) return 'var(--sb-gold)';
  if (/\bgst\b/.test(n)) return 'var(--law-GST)';
  if (/\bfema\b|\brbi\b|\bfdi\b|foreign exchange|\bodi\b/.test(n)) return 'var(--law-FEMA)';
  if (/payroll|\bepf\b|\bpf\b|\besic?\b|provident|labou?r/.test(n)) return 'var(--law-PAY)';
  if (/income[\s-]?tax|\btds\b|\btcs\b|\bitr\b/.test(n)) return 'var(--law-IT)';
  if (/incorporat|\bmca\b|\broc\b|companies act|secretarial|\bspice\b/.test(n)) return 'var(--law-MCA)';
  return null;
}
