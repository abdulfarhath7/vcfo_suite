# Generated documents: incorporation drafts, document pack, board resolution

Gotchas already paid for once. Append when something costs more than a minute to figure out.

## Document pack (2026-09-22)

- Section tabs have no ids. The pack links to a tab by `sectionSlug(field.section)`
  (`src/lib/doc-pack/section-slug.ts`) and the step page reads `?tab=<slug>` in
  `useMilestoneResponseFormState`; an unknown slug leaves the first tab. Part A's
  tab set varies with `ownershipType`, so never store a tab index.
- Pack item keys are `{docId}:{audience}` — the same `doc:audience` row keys Pre-7
  uses for `sharedIncorpDraftDocs`, so `incorpDocRowKey` maps both ways. URL-encode
  the colon in links (`docPackItemUrl`).
- The generators render every director with a residency (up to six per kind);
  `evaluateDocPack` lists only directors without a residency, or past the ceiling,
  in `summary.skippedDirectors`.
- `src/lib/api/doc-pack.ts` imports the auth guard, so any test importing it must
  mock `@/auth/guards` and `@/db/repositories/doc-pack` (next-auth pulls `next/server`).
- `src/views/intern/useBoardResolutionEditorState.tsx` has a blank line after
  every line; keep that format when editing or the diff doubles in size.
- Pre-7 keeps writing `*DraftUrl` paths (its validator requires them). The pack
  reads them and serves the attached file when present; it never writes them.

## Per-director incorporation drafts (2026-09-23)

- **Audience keys and prefixes** (`src/lib/incorporation-docs/audiences.ts` is the
  only place that builds them): first non-resident `non-resident` / `nrDirector`,
  first resident `resident` / `residentDirector`, nth `non-resident-{n}` /
  `nrDirector{n}` and `resident-{n}` / `residentDirector{n}`. Slot numbering is per
  residency in list order, the same as `directorsAsPre6Responses`. Draft ids are
  `{prefix}{docSuffix}DraftUrl`, signed ids `{prefix}{docSuffix}SignedUrl`; company
  docs keep their fixed ids. Slot 1 ids, row keys and S3 paths are unchanged.
- **Pre-7 / pre-8 fields are a static superset.** `expandDirectorSlotFields` declares
  slots 2–6 after each slot-1 field; the form shows only the directors on file
  (`fieldsForDirectorAudiences`) and read-only lists hide later slots until they hold
  a value (`withoutUnusedDirectorSlots`, pre-7 / pre-8 only — pre-6 has its own
  `nrDirector2…` KYC fields). `extractItemResponses` keeps only declared ids, so a
  new per-director id must be declared or it is dropped on read.
- **Frozen slot set.** Once pre-7 is shared (`incorpDraftsSharedAt`) or accepted,
  slots that were not in the legacy set become optional (`isIncorpSlotSetFrozen`);
  pre-8 does the same once accepted. The two declarations are always optional.
- **Renumbering.** Removing or reordering a director renumbers the slots: the drafts
  and uploads stay under the old key (`resident-2` might now be a different person).
  Stable entry ids would fix it; not done. Regenerate after changing the list.
- **Applicability without data.** A doc with `appliesToDirector` (ID & address
  declaration — DIN holders only) is not laid out when no `pre6` map is passed;
  stored drafts still list through `ignoreAppliesTo`.
- **DIR-8 table** is a docxtemplater row loop (`PRIOR_DIRECTORSHIPS`); `renderDocx`
  takes array data only for declared loop keys. Templates are re-tagged by
  `scripts/incorp-docx-retag.mjs` and the declarations built by
  `scripts/incorp-docx-build-declarations.mjs` — both idempotent; edit the scripts,
  not the .docx by hand.
- `tsc --noEmit` is incremental here (`tsconfig.tsbuildinfo`); use
  `--incremental false` for a gate you trust — a stale build info once hid a test
  typing error.
- Pre-2 board resolution picks its template by NOC variant (`boardResolutionVariant`
  in `src/lib/board-resolution/board-resolution.ts`): foreign → `boardResolution.docx`, Indian
  investing / name use → `boardResolution-indian-*.docx`. Those are built from the
  firm's blank `noc-indian-*.docx` (kept as supplied) by
  `node scripts/prepare-noc-board-resolution-docx.mjs`; both prepare scripts share
  `scripts/docx-comment-tags.mjs`. Standalone or an unanswered Indian role falls
  back to the foreign template.
- The board resolution's signature block (foreign and Indian-investing templates) is
  rewritten by `scripts/br-signature-block.mjs`, which both prepare scripts call through
  the `beforeWrite` hook; `node scripts/br-signature-block.mjs` applies it to the tagged
  templates in place and is safe to run twice. Keep one Word paragraph per label and per
  value: the editor saves one line per paragraph and moves a tab or a line break inside a
  paragraph to its start, so a tab-stop layout would break on the first save.
- docx-preview writes the document defaults as a rule for every span (`.docx span`, the
  theme font at 12 pt). A span the app adds inside the preview, such as the merge-field
  highlight, must inherit its run's font, or it prints bigger and in another font.

## Spectrum styling (2026-11-11)

Generated documents follow VCFO Spectrum only where that is safe. A statutory or filing
document keeps the layout that MCA, the ROC, the Secretarial Standards or a labour law
expects, and gets no Spectrum colour, face, logo or background. A firm-branded working
document takes the Spectrum palette. When unsure, a document is class (a).

| Document | Generator | Class | What Spectrum changes |
| --- | --- | --- | --- |
| DIR-2 consent to act as director | `incorporation-docs/dir2.ts`, `templates/dir-2.docx` | (a) statutory, uploaded to SPICe+ | Nothing |
| DIR-8 intimation by director | `incorporation-docs/dir8.ts`, `templates/dir-8.docx` | (a) statutory, uploaded | Nothing |
| INC-9 declaration | `incorporation-docs/inc9.ts`, `templates/inc-9.docx` | (a) statutory, uploaded | Nothing |
| PAN undertaking | `incorporation-docs/pan-undertaking.ts` | (a) uploaded with SPICe+ | Nothing |
| MoA (INC-33) and AoA (INC-34) | `incorporation-docs/moa.ts`, `aoa.ts` | (a) prescribed Table A/F wording, filed | Nothing (see the AoA note below) |
| MoA / AoA subscription sheets (foreign and resident) | `incorporation-docs/subscription-sheet.ts` | (a) filed with the e-MoA / e-AoA | Nothing |
| ID & address declaration, deposit declaration | `incorporation-docs/declarations.ts` | (a) Rule 16 declarations, uploaded | Nothing |
| Authorisation letter (to the ROC) | `incorporation-docs/authorisation-letter.ts` | (a) SPICe+ attachment, signed by the parent | Nothing |
| Acceptance letter | `incorporation-docs/acceptance-letter.ts` | (a) SPICe+ attachment | Nothing |
| Board resolution, certified true copy (foreign, Indian investing, Indian name use) | `board-resolution/`, `templates/boardResolution*.docx` | (a) certified and uploaded | Nothing |
| NOC templates (`noc-*.docx`) | `scripts/prepare-noc-board-resolution-docx.mjs` | (a) the firm's blanks, kept as supplied | Nothing |
| Board meeting notice and agenda, resolution by circulation | `board-meetings/notice-docx.ts`, `resolution.ts` | (a) SS-1 notice on the company's own letterhead | Nothing |
| Labour registers (PDF and Excel) | `labour-registers/pdf/`, `labour-registers/xlsx/` | (a) forms prescribed by the labour codes | Nothing |
| Incorporation drafts ZIP, project ZIP, doc pack | `incorporation-docs/zip.ts`, `projects/project-zip.ts`, `doc-pack/` | Containers of (a) files; the doc pack is a screen, not a file | Nothing |
| Monthly partner report (PDF) | `reports/partner-report-document.tsx` | (b) firm report | Spectrum print palette |
| Ask VCFO brief and monthly status brief (PDF) | `ask/pdf-brief-document.tsx`, `ask/pdf-status-brief-document.tsx` | (b) client-facing, firm-branded | Spectrum print palette |
| Budget board pack (PDF) | `budget/pdf.tsx` | (b) firm-branded report | Spectrum print palette |
| Receivables statements, budget workbook, table exports, project ZIP sheets (Excel) | `receivables/*xlsx*`, `budget/xlsx.ts`, `exports/table-xlsx.ts`, `projects/project-zip-tables.ts` | (b) working files | Not restyled yet; follow-up |

How it is wired:

- `node scripts/design-tokens-docs.mjs --write` generates `src/lib/doc-style/spectrum-tokens.ts`
  (light-theme hex, aliases resolved, and the `ui` and `mono` font names) from
  `docs/design/design-tokens.json`. `spectrum-tokens.test.ts` fails when the two drift.
- `src/lib/doc-style/spectrum-docx.ts` is the one Word helper: run properties in the `ui` face and
  ink, identifiers (CIN, DIN, PAN, SRN) in the `mono` face, the 2px ink rule, hairline table
  borders, the sunken table-head fill, the six status words in their chip tones, and a
  `fontTable.xml` whose `w:altName` falls back to Arial and Consolas (fonts are not embedded).
  No generated Word file is class (b) today, so the helper has no caller yet; the first firm
  cover letter, checklist or summary in Word should use it.
- `src/lib/doc-style/spectrum-pdf.ts` is the print palette for the react-pdf documents. They stay
  on Helvetica, the metric twin of Arial, because the repo ships no TTF of the Spectrum faces.
- `statutory-docs.test.ts` renders every class (a) Word file and scans every template in
  `public/templates/` for a Spectrum accent colour or face; `spectrum-pdf.test.ts` fails when a
  class (b) PDF style sheet carries a literal hex.
- The `public/templates/*.docx` files are byte-identical. The AoA template has 39 runs in
  `#222222`, pasted with the clause text, among about a thousand runs in automatic black.
  Recolouring only those runs to the ink navy would make 39 clauses look different from the
  rest, so they were left as they are.
- Fonts are Roboto (ui) and Roboto Mono (identifiers), read from `docs/design/design-tokens.json`
  (R-28, as `app/layout.tsx` loads them). CLAUDE.md and `docs/context/notes/design-system.md`
  still say Public Sans and IBM Plex Mono; that is out of date. Word takes one `w:altName` per
  face, so the declared fallbacks are Arial and Consolas; Word picks Calibri itself when Arial
  is missing too.

## Clean downloads, place, alignment, per-director letter (2026-11-11)

- **Yellow marking.** The templates highlight every merged value. Stored drafts
  keep it; every download strips it (`stripDocxHighlights` /
  `docxForResponse` in `docx-sanitize.ts`): single downloads, the doc pack zip,
  the drafts zip, the "Download documents" pop-up (`openDownloadFile` in `src/lib/document-downloads/bundle.ts`) and the board resolution. The in-app preview
  adds `?preview=1` in `use-docx-preview.ts`, which the routes read
  (`isDocxPreviewRequest`) to keep the marking. A new download route must call
  `docxForResponse` too.
- **Place outside India is a country** (`signingPlace` in `shared.ts`): the
  country in the pre-15 place, else in the address (`countryFromAddress` reads
  US / Canada / UK postal patterns), else nationality, else "Foreign".
- **Alignment.** `renderDocx` left-aligns every table cell that holds a merge
  tag (`leftAlignTableValueCells`) before rendering; label and header cells keep
  their alignment. Stored drafts change only when regenerated.
- **Authorisation letter** is `non-resident-only`: one per director whose pre-15
  "Whether resident in India" is "no" (`nrDirector{n}AuthorisationLetterDraftUrl`,
  pre-8 `nrDirector{n}AuthorisationLetterSignedUrl`). The old company-level
  `authorisationLetterDraftUrl` / `authorisationLetterSignedUrl` are no longer
  read, and an earlier client share of the letter must be redone. It is signed
  by Part A's board resolution signatory and cites `pre1.boardResolutionDate`
  (`{BOARD_RESOLUTION_DATE}`, added by `incorp-docx-build-sourced-fields.mjs`).
- **Subscription sheet representative** is the director named on pre-16
  (`authorisedPerson`, or `shareholderAuthorizedPerson` when the parent
  subscribes alone), else the first non-resident director as before.

## Incorporation Documents row and per-director page (2026-11-12)

- The steps card (`RecordStepsCard`) shows INCORPORATION DOCUMENTS right after KYC Review &
  DSC (`IncorporationDocumentsJourneyRow`). It is not a checklist step: it never gates SPICe+
  Confirmation, has no answers, and does not renumber the steps. It links to the documents page.
- The documents page (`DocPackView`, route `/documents`) is titled "Incorporation Documents".
  Each part lists the documents under "Director n · name · Outside India / Resident in India"
  as a tree, then "Company documents" (`groupByDirector`). The window bar no longer carries an
  "Open in document pack" link.
- An earlier attempt made this a real step `pre-17` (stashed as "other-session pre-17
  incorporation documents"); it was not used because it locks SPICe+ Confirmation on live
  projects until the new step is completed.
