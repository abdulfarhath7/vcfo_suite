# Board document part: API (30 Oct 2026)

The doc agent owns this file and `src/components/board-doc/`. The data agent and the two screen
agents (staff page, client page) code against it. Source: the prototype's
`docs/BOARD-RESOLUTION-NOC.md` section 5 (and C2, C4, C5, C6, C7, C8 table, T4, T5) and rule R-52.

Import everything from `@/components/board-doc`. Every part is presentational: it takes data and
callbacks, fetches nothing except the signed copy bytes (same-origin URL only), and writes nothing.
Tokens only, light and dark, and every part works at phone width.

The part never draws a signature or a seal. The Signed copy view shows only the uploaded file.

## Shared types (`types.ts`)

```ts
type IsoTime = string;                       // full ISO timestamp, or 'YYYY-MM-DD'

/** One step of a document's track ("Drafted", "Notarised"). */
interface DocStageDef { key: string; label: string }

/** What happened at a step. A step is done when `at` is set. Every date comes from one record (P2). */
interface DocStageRecord { at?: IsoTime | null; by?: string | null }
type DocStageRecords = Record<string, DocStageRecord | undefined>;

/** One line of the "What you do" list; `stage` is the track step that ticks it. */
interface DocTodoDef { key: string; label: string; stage: string }

/** One tick of the receive checklist. */
interface DocCheckDef { key: string; label: string }

type DocKind = 'board-resolution-noc' | 'resolution-by-circulation' | 'notice-agenda' | 'minutes';

/** A document type gives its steps, its letterhead source, its to-do list and its checklist. */
interface DocTypeDef {
  kind: DocKind;
  title: string;                           // "Board resolution (NOC)"
  subtitle?: string;                       // the variant label, "NOC — Foreign subsidiary"
  letterhead: 'parent' | 'company';
  stages: DocStageDef[];
  todo: DocTodoDef[];
  checks: DocCheckDef[];
}

/** A value filled from an answer. `source` names the field ("Project setup · Parent name"). */
interface MergeValue {
  key: string;                             // merge key, e.g. 'PARENT_ENTITY_NAME'
  value: string;
  source: string;
  missing?: boolean;                       // a placeholder ("[Designation]", "____"): faint, dashed, "Not given yet"
}

/** The paper the Draft tab draws. */
interface DocModel {
  letterhead: { name: string; address?: string; note?: string } | null;  // null: a plain page
  heading?: string;
  dates?: Array<{ label: string; value: string }>;                      // "Meeting" · "24 Sep 2026"
  sections: Array<{ label?: string; paragraphs: string[] }>;              // margin label + text
}

interface DocVersion {
  id: string;
  label: string;                           // "Version 2"
  at?: IsoTime | null;
  by?: string | null;
  values: Record<string, string>;          // merge key -> value used for that version
}

interface DocFile {
  id: string;
  title: string;                           // "Draft · Word", "Signed copy" (never the internal name for clients)
  type?: FileType;                         // from '@/components/ui/file-badge'; else from `name`
  name?: string;                           // internal file name; shown only with `showInternalName`
  status?: string;                         // "Released", "Received" (green word)
  by?: string | null;
  at?: IsoTime | null;
}

interface SignedCopy {
  name: string;
  url: string | (() => Promise<string>);   // same-origin routes are fetched as a blob (they send attachment)
  contentType?: string | null;
  uploadedAt?: IsoTime | null;
  uploadedBy?: string | null;
}

interface AuditLine { id: string; at: IsoTime; who: string; text: string }   // "Released", "Sent back · Stamp missing"

interface EvidenceRow {
  n: number;                               // the numbered badge (1, 2, 3)
  asked: string;                           // "Project setup · Ownership type"
  answer: string;                          // the real project answer, or "Not chosen yet"
  chose: string;                           // "Subsidiary, not standalone"
  missing?: boolean;
}
```

## Document types (`doc-types.ts`)

| Export | What it gives |
|---|---|
| `nocDocType(variant: NocVariant \| null, opts?: { notary?: boolean })` | The NOC type. Foreign parent: stages `drafted, released, signed, notarised, apostilled, accepted`, 5 to-do lines, 6 checks. Indian parent, or `notary: false` (D1, SBC turned it off): 4 stages, 4 to-do lines (no step 4), 4 checks. `subtitle` is the `NOC_TEMPLATES` label. |
| `NOC_STAGE_KEYS` | `{ drafted, released, signed, notarised, apostilled, accepted }` string constants. |
| `UPLOADED_KEY` | `'uploaded'`: the record key of the signed scan upload. It is not a track step; the "Upload the scan" line ticks on it (or on Accepted). The other to-do lines tick on `signed` and `apostilled`. |
| `DOC_TYPES` | `resolutionByCirculation`, `noticeAgenda`, `minutes` defs for the later board meeting features (proposal section 7). |
| `needsNotary(variant)` | True for `foreign-parent`. |

## Pure helpers

| Export | File | Contract |
|---|---|---|
| `docDay(iso)` | `format.ts` | "14 Oct" on the India date; `''` for empty or bad input. `docDate(iso)` gives "14 Oct 2026". |
| `trackStates(stages, records)` | `track.ts` | `Array<{ key, label, state: 'done' \| 'now' \| 'next', at?, by? }>`. Done = has `at`. Now = the first open step. |
| `todoStates(type, records)` | `track.ts` | `Array<{ key, label, state }>` for the "What you do" list, from the same records. |
| `segmentText(text, values)` | `merge-segments.ts` | Splits a paragraph into `Array<{ text } \| { text, field: MergeValue }>`; longest value first, no overlaps, values under 2 characters skipped. |
| `isPlaceholder(value)` | `merge-segments.ts` | True for `[...]`, `___`, empty. |
| `signedKind(file)` | `signed-kind.ts` | `'pdf' \| 'image' \| 'other'` from the content type or the name. |
| `plainDocDate(raw)` | `noc-doc.ts` | "SEPTEMBER 24, 2026" or "24th September, 2026" to "24 Sep 2026". |
| `NOC_FIELD_SOURCES`, `NOC_FIELD_LABELS` | `noc-doc.ts` | Merge key to "Pre-1 · Parent company name", and the same without "Pre-1 · " (pass as `VersionCompare labels`). |
| `diffValues(from, to, labels?)` | `version-diff.ts` | `Array<{ key, label, before, after }>` for values that changed, added or removed. |
| `nocMergeValues(fields: BoardResolutionMergeFields)` | `noc-doc.ts` | `MergeValue[]` with a `source` for each key ("Pre-1 · Parent company name"); `DIRECTOR_NAMES` splits into one value per director; placeholders come back `missing`. |
| `nocDocModel({ content, fields, letterhead? })` | `noc-doc.ts` | A `DocModel` from the stored draft content (`BoardResolutionDoc.content`, plain or structured; see `parseBoardResolutionPatchContent`), with the margin labels Purpose · Decision · Who signs · Filing agent · Certifies and the two date labels "Meeting" and "Certified" (P3). Pass `generateBoardResolutionDraft(...)` as `content` when nothing is stored. `letterhead` defaults to the parent's name and address from `fields`. |
| `nocEvidence(project)` | `noc-doc.ts` | `{ rows: EvidenceRow[], outcome, variant, path }` from `ownershipType`, `companyType`, `parentIndianRelationship` (F3). `outcome`: `'standalone' \| 'foreign' \| 'indian-name-only' \| 'indian-investing' \| 'indian-not-chosen' \| 'incomplete'` (`incomplete`: a subsidiary with no company type). `path` lists the tree node ids to light, in order (`'subsidiary'`, `'foreign'`, `'indian'`, `'name-only'`, `'investing'`, `'not-chosen'`, `'standalone'`) so the client page's tree and table agree. Labels: "Project setup · Ownership type", "Project setup · Company type", "Project setup · Parent's role". |

## Components

| Component | Props | Notes |
|---|---|---|
| `DocTrack` | `{ stages: DocStageDef[]; records: DocStageRecords; nowLabel?: string; nowTone?: 'prog' \| 'teal'; label?: string; className? }` | ST5 strip (C2). Done steps show "who · 14 Oct". The now step shows `nowLabel` ("Waiting on Northwind") or "Now". 2 columns on phones, 3 on tablets, one row from `lg`. |
| `DocTodo` | `{ items: ReturnType<typeof todoStates>; action?: ReactNode; className? }` | Numbered list (C4): the now line has the brand-soft fill, done lines a tick. `action` is the one main button, drawn in the foot. |
| `DocPaper` | `{ model: DocModel; values: MergeValue[]; onField?: (v: MergeValue) => void; canEdit?: (v: MergeValue) => boolean; activeKey?: string \| null; className? }` | The Draft tab body (C5). Filled values have the brand-soft tint; a click (or Enter) calls `onField` when `canEdit` allows it, else a small note names the source ("From Pre-1 · Parent company name"). Missing values: faint, dashed, labelled "Not given yet". Margin labels stack above the text on phones. |
| `SignedCopyView` | `{ file: SignedCopy \| null; onOpenFull?: () => void; height?: number; className? }` | The Signed copy tab (C6). PDF: inline frame of the uploaded file. Image: the image. Other types: the file row with Open. Empty: "No signed copy yet". Never draws a signature. |
| `DocPreviewCard` | `{ tab: 'draft' \| 'signed'; onTab: (t) => void; draft: ReactNode; signed: ReactNode; meta?: ReactNode; right?: ReactNode; className? }` | Card with the Draft / Signed copy tabs and both panels. `meta` is the version tag ("Version 2"), `right` holds zoom or full-screen buttons. Keeps the tab-switch event so card animations still run. |
| `VersionCompare` | `{ versions: DocVersion[]; labels?: Record<string, string>; initialFrom?: string; initialTo?: string; className? }` | T4. Two compact selects (default: the last two versions) and the changed values as "before → after" rows. One version or none: "One version only". No change: "No values changed". Put it in a Dialog or side panel on the staff page. |
| `ReceiveChecklist` | `{ checks: DocCheckDef[]; ticked: string[]; onTick: (key, on) => void; onAccept: () => void; onSendBack: (reason: string) => void; done?: boolean; busy?: boolean; className? }` | T5. "{n} of {total}" tag. Accept is disabled until every check is ticked. Send back opens an inline reason box; it cannot send with an empty reason. `done` locks every box. |
| `DocFiles` | `{ files: DocFile[]; showInternalName?: boolean; onOpen?: (f) => void; onDownload?: (f) => void; footer?: ReactNode; className? }` | C7. Client pages leave `showInternalName` false (P5). `footer` takes the replace or upload drop zone, which the page owns. |
| `EvidenceTable` | `{ rows: EvidenceRow[]; result?: ReactNode; className? }` | The table under the tree (C8): # · VCFO asked · The answer · So VCFO chose. A missing answer is faint. `result` is the "This choice adds 2 steps · Notarise · Apostille" line. On phones each row becomes a stacked block. |
| `AuditLines` | `{ lines: AuditLine[]; empty?: string; className? }` | Audit trail (W6), newest first, "14 Oct · Bharath · Released". |

## What the other agents supply

- Data agent: stage records (`drafted`, `released`, `signed`, `notarised`, `apostilled`, `accepted`
  with `at` and `by`), versions with their merge values, audit lines, and the notary switch (D1).
- Staff page: `ReceiveChecklist`, `VersionCompare` in a dialog, `DocFiles showInternalName`, the template card.
- Client page: `DocTrack`, `DocTodo`, `DocPreviewCard` with `DocPaper` and `SignedCopyView`, `DocFiles`,
  `EvidenceTable` with the tree it draws from `nocEvidence().path`.
