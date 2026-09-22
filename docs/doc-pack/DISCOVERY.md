# Pre-incorporation document pack — Phase 0 discovery

Read-only findings for `docs/DOC-PACK-CONTEXT.md` §3, taken from the repo at `0552062` (2026-09-22). No code was changed. Section 12 lists where the context file no longer matches the repo.

---

## 1. Generators

All pre-incorporation generators except the board resolution live in `src/lib/incorporation-docs/`. They share one input shape and one dispatcher.

**Shared plumbing**

- Registry: `INCORP_DOC_DEFINITIONS` in `src/lib/incorporation-docs/types.ts:55-150`, 10 kinds (`types.ts:17-28`). Each definition carries `templateRelative`, `directors` (audience rule), `draftUrlField` (audience → pre-7 response key) and `downloadFilename(audience)`.
- Audiences: `audiencesForDoc()` `types.ts:152-157` returns `['non-resident']`, `['company']` or `['non-resident','resident']`. Audience type is still the fixed three-string union in `shared.ts:9-12`. There is no `resident-2` style expansion anywhere yet.
- Input: `IncorpMergeInput { engagement, pre1, pre5, pre6, director }` `shared.ts:14-23`. `pre1`/`pre6` are *synthesised* by `directorResponsesFromState(state)` in `src/lib/proposed-directors.ts:188-207`: it reads the `pre-15` repeat entries (`readProposedDirectors` `:103-110`) and maps them into legacy `nrDirector*` / `residentDirector*` keys (`directorsAsPre6Responses` `:146-160`, `directorsAsPre1Responses` `:163-181`), falling back to real `pre-1` / `pre-6` slots on old engagements. Registered office is overlaid from `pre-14` (then `pre-8`, then `pre-6`) via `src/lib/registered-office-responses.ts:28-43`.
- Company name: `resolveProposedCompanyName(pre5, pre1, engagement)` `shared.ts:69-80` = `pre-5.approvedCompanyName` → `pre-1.proposedName1` → `engagement.companyName`.
- Render: `renderIncorpDocxBuffer(doc, input)` `docx.ts:209-234` is the single dispatcher. `renderDocx()` `docx.ts:76-100` loads `public/templates/*` with PizZip + Docxtemplater, then sanitises and validates the XML.
- Filenames: `incorpDocDownloadFilename(doc, audience, { pre6 })` `paths.ts:55-66`. Director docs append `-{slug of director display name}` before `.docx`; company docs keep the bare name.
- Storage key: `uploadIncorpDocx()` `storage.ts:33-50` → bucket prefix `milestone-documents` + `{engagementUuid}/{draftUrlField}/{Date.now()}-{filename}` (`src/lib/milestone-document-storage.ts:39-47`).

**Per document**

| Doc id | Builder | Reads | Expands | Template | Filename base |
|---|---|---|---|---|---|
| `dir-2` | `dir2.ts:55-90` | company name; director `FullName, FatherName, UtilityBillAddress, PersonalMailId, OfficialMailId, MobileNumber, PanNumber, OccupationType, Dob, UtilityBillType`; DIN hardcoded `'-'` | per director (NR + resident) | `dir-2.docx` | `dir-2-{non-resident\|resident}-director` |
| `dir-8` | `dir8.ts:48-69` | company name; `FullName, FatherName, UtilityBillAddress`; prior directorships hardcoded `'NA'` | per director | `dir-8.docx` | `dir-8-…-director` |
| `inc-9` | `inc9.ts:24-39` | company name; `FullName` | per director | `inc-9.docx` | `inc-9-…-director` |
| `pan-undertaking` | `pan-undertaking.ts:28-54` | `FullName, FatherName, PassportNumber, UtilityBillAddress` | non-resident only (`types.ts:96`) | `pan-undertaking.docx` | `pan-undertaking-non-resident-director` |
| `moa` | `moa.ts:129-147` | `pre-1` `authorisedShareCapital, paidUpShareCapital, nominalValuePerEquityShare`; registered office (`pre6`+`pre8`) | company | `moa.docx` | `moa` |
| `aoa` | `aoa.ts:76-85` | all director names (pre6, then legacy pre-1 `director{n}*`) merged into one list string (`aoa.ts:35-74`) | company | `aoa.docx` | `aoa` |
| `authorisation-letter` | `authorisation-letter.ts:49-82` | `pre-1` parent entity name/address/registration, signatory name + designation; NR director `FullName, PassportNumber, UtilityBillAddress` | company | `authorisation-letter.docx` | `authorisation-letter` |
| `acceptance-letter` | `acceptance-letter.ts:40-75` | parent entity name/address/country; NR director `FullName, FatherName, PassportNumber, UtilityBillAddress` | company | `acceptance-letter.docx` | `acceptance-letter` |
| `moa-subscription-sheet` | `subscription-sheet.ts:79-134` | parent entity; `pre-1.paidUpShareCapital` share count; NR director as subscriber | company | `moa-aoa-subscription-sheet-foreign.docx` | `moa-subscription-sheet` |
| `aoa-subscription-sheet` | same | same | company | same template | `aoa-subscription-sheet` |

Notes:
- **No generator expands per subscriber.** `subscriptionSheetVariantForDoc` `subscription-sheet.ts:72-77` ignores its argument and always returns `'foreign'`, so the subscriber is always the first non-resident director. `pre-13` and `pre-16` are read by no generator. The resident subscription template (`MOA & AOA Subcription Sheets Resident.docx`) exists in `public/templates/` but is unreferenced.
- Missing-field collectors already exist per doc: `collectMoaMissingFields` `moa.ts:149-173`, `collectAoaMissingFields` `aoa.ts:87-101`, `collectAuthorisationLetterMissingFields` `authorisation-letter.ts:84-116`, `collectAcceptanceLetterMissingFields` `acceptance-letter.ts:77-105`, aggregated by `collectIncorpDocsMissingFields` in `src/lib/api/incorporation-docs-errors.ts`. Phase 1's `requiredInputs` can be derived from these rather than invented.

**Board resolution (separate system, Pre-2)**

- `renderBoardResolutionDocxBuffer(input)` `src/lib/board-resolution-docx.ts:201-263`; `generateBoardResolutionArtifacts` `:303-341` returns `{ content, docx }`.
- Input `{ engagement, pre1, overrides }` `src/lib/board-resolution.ts:73-83`. Directors come from `directorResponsesFromState(state).pre1` (`src/lib/api/board-resolution-generate.ts:44`). No pre-5 / pre-6 read.
- Template `public/templates/boardResolution.docx` (`board-resolution-docx.ts:64`). Stored filename fixed: `board-resolution.docx` (`src/lib/board-resolution-storage.ts:25`). No per-director expansion.

## 2. Pre-2 board resolution card

- Step-row CTA: `src/components/incorporation/ChecklistPhaseStepRow.tsx:68-77` (only for `pre-2`). Step-detail card: `src/components/admin/StepDetailContentSections.tsx:152-176`, component `src/components/incorporation/BoardResolutionStepLink.tsx:20-106` (status `none | draft | finalized`, links to the editor).
- Editor: `src/views/intern/BoardResolutionEditorView.tsx` + `useBoardResolutionEditorState.tsx` (generate `:297`, download href `:580`, finalize `:728-806`). Client card `src/components/client/ClientBoardResolutionCard.tsx:32-66` renders only when `status === 'finalized' && storagePath`.
- Storage row: `engagement_board_resolutions` `src/db/schema.ts:264-281`, one row per engagement. `status` is `'draft' | 'finalized'` on the same row; `storagePath`, `signedStoragePath`, `finalizedAt`, `finalizedBy`, `templateFingerprint`. Drafts are not separate rows.
- Repository `src/db/repositories/board-resolution.ts`: `getBoardResolutionByEngagementId` `:61-75`, `saveBoardResolutionDraft` `:77-122` (throws once finalized), `finalizeBoardResolution` `:161-195`, `setSignedBoardResolution` `:197-225`.
- Docx object: `{engagementUuid}/board-resolution.docx` under prefix `engagement-documents`, overwritten in place (`board-resolution-storage.ts:29-33`).
- Download today: `app/api/engagements/[id]/board-resolution/download/route.ts` streams bytes directly (no presign), sanitises, sets `Content-Disposition: attachment; filename="board-resolution.docx"`. Clients get 403 unless `status === 'finalized'` (`:50-60`). Staff can download a draft here, which the pack must not expose (context §2 rule 3).
- BR readiness for the pack = `row.status === 'finalized' && row.storagePath` non-empty.

## 3. Pre-7 generate panel and its side effects

- Component `src/components/incorporation/IncorporationDocsGeneratePanel.tsx:109-282`, mounted for staff only at `src/components/incorporation/Phase1StepPanelRoutePanels.tsx:349`. `generate(docs?)` `:155-209` POSTs `/api/engagements/{id}/incorporation-docs/generate` with `{ docs }` (empty = all kinds).
- Route `app/api/engagements/[id]/incorporation-docs/generate/route.ts` (POST) → `generateAndStoreIncorpDocs` in `src/lib/api/incorporation-docs-generate.ts:75-192`.

**Side effects of one generate call**

1. Access: `requireAnyRole('admin','manager','intern')` + `assertEngagementBoardResolutionAccess` (`route.ts:34-47`).
2. Validation: `validateIncorpDocsGeneration` (`incorporation-docs-errors.ts:246-286`) requires directors accepted (`pre-15.reviewStatus === 'accepted'`, else legacy `pre-6`) (`:97-104`), then missing-field check → error. Skipped on the inline-edit path.
3. **S3 upload**: one `putObject` per (doc, audience) (`incorporation-docs-generate.ts:146,173`). Every generate writes a new timestamped object; old objects are orphaned, never deleted.
4. **checklist_state write**: `patchChecklistItem(ctx, id, 'pre-7', { responses: responsePatch })` (`:187-189`). Keys are the 13 `*DraftUrl` fields in `types.ts:30-43`; values are storage paths. This is what the pack page would lose if Pre-7 generation is retired without replacement.
5. Step **not** marked complete: patch carries only `responses` (no `status`, `completedOn`, `deliveredToClientAt`).
6. Inline edit path (`content` present, exactly one doc + director): downloads, patches XML, uploads to a **new** key, and **skips** the checklist patch (`:120-158,187`), so the new path is only merged client-side.
7. **Audit**: `incorporation_docs.generate` or `incorporation_docs.patch` (`route.ts:97-106`), plus `auditChecklistItemPatch` inside `patchChecklistItem` (`engagements.ts:480`).
8. **No email, no in-app notification** on generate.
9. Client side: `mergeEngagementChecklistResponses`, `refreshEngagementChecklist`, toast, preview unlock (`IncorporationDocsGeneratePanel.tsx:184-198`).

**Pre-7 completion depends on generated docs**

- `PRE7_REQUIRED_FILE_IDS` `src/lib/checklist-pre7-validation.ts:6-22` lists 12 of the 13 draft fields (not `nrDirectorPanUndertakingDraftUrl`) plus three manual uploads (`nrDirectorDscSuccessMessageUrl`, `residentDirectorDscSuccessMessageUrl`, `boardResolutionDraftForIncorpUrl`). `validatePre7Responses` `:30-53` blocks Submit until each is non-empty. **Retiring the Pre-7 panel (Phase 5c) without a replacement writer would make Pre-7 impossible to complete.**
- `allIncorpDraftSlotsGenerated` `share.ts:35-37` and `isBulkIncorpShareComplete` `share.ts:67-76` gate the bulk-share bar (`IncorporationDocsBulkShareBar.tsx:53-55,117`).

**Share and client visibility (unchanged by the pack, but adjacent)**

- Share route `app/api/engagements/[id]/incorporation-docs/share/route.ts`: bulk (`:76-121`) writes `sharedIncorpDraftDocs` + `incorpDraftsSharedAt` to pre-7, audits `incorporation_docs.share_all`, and **emails** via `notifyEngagementEvent({ event: 'docs_shared' })` (`:108-113`). Single share (`:124-182`) appends `doc:audience`, audits, emails on first share.
- Client at pre-8 (`Phase1StepPanelRoutePanels.tsx:356-419`) sees only rows in `sharedIncorpDraftDocs` via `filterClientVisibleIncorpDrafts` (`share.ts:78-86`) and downloads through the existing download route.
- Legacy parallel routes still exist: `app/api/engagements/[id]/dir-2/{generate,download}` backed by deprecated `generateAndStoreDir2`.

## 4. Step catalog ids

Part A = phase `pre-inc-phase-1` (`src/data/checklist.ts:433-437`), `itemIds` at `:436`:

| id | title | slug |
|---|---|---|
| `pre-1` | Client Details | `name-application` |
| `pre-2` | Draft Board Resolution | `board-resolution-draft` |
| `pre-3` | Signed Board Resolution | `board-resolution-execution` |
| `pre-4` | Name Application | `name-application-filing` |
| `pre-5` | Name Approval | `mca-name-approval` |

Part B = phase `pre-inc-phase-2` (`checklist.ts:439-443`), `itemIds` at `:442`:

| id | title | slug |
|---|---|---|
| `pre-13` | Capital Structure | `capital-structure` |
| `pre-14` | Registered Office Address | `registered-office-address` |
| `pre-15` | Proposed Directors | `proposed-directors` |
| `pre-16` | Subscriber Details | `subscriber-details` |
| `pre-7` | KYC Review & DSC | `kyc-review-and-dsc-creation` |
| `pre-8` | Document Execution | `execution-of-incorporation-documents` |
| `pre-9` | SPICe+ Confirmation | `spice-part-b-confirmation` |
| `pre-10` | SPICe+ Filing | `incorporation-filing` |
| `pre-11` | MCA Remarks | `mca-remarks-resubmissions` |
| `pre-12` | Certificate of Incorporation | `certificate-of-incorporation-sharing` |

`pre-6` Director KYC (`checklist.ts:240`) is in the catalog but in no phase; legacy-only.

**Section tabs have no ids.** A tab is the `section:` label string on a field, grouped by `groupFieldsBySection` (`src/views/incorporation/useMilestoneResponseFormState.tsx:626-629`). DOM ids are positional `intern-section-tab-${index}` (`MilestoneResponseFormParts.tsx:371`).

- Client Details (`pre-1`) order from `src/lib/part-a-sections.ts:16-25,38-48`: Business Description, Proposed Company Names, Foreign Entity, Foreign Entity Proof, Authorized Signatory, Signatory KYC, Company Mail ID, Company Mobile Number, Share Capital Details. Items 3–6 dropped when `ownershipType === 'independent'` (`:54-59`), so a tab index is not stable across engagements; a label is.
- Proposed Directors (`pre-15`): one section `'Directors'` (`checklist-responses.ts:804`), repeat group `directors`, per-entry ids `directors.<entryId>.<fieldId>` (`src/lib/checklist-repeat.ts:40-42`), entries render as cards (`RepeatGroupEditor.tsx`), not tabs.
- Other Part B sections: `pre-13` `Capital structure`, `pre-14` `Registered office`, `pre-16` `Subscribers` + `INC-35 nominee`, `pre-7` `KYC review` / `DSC creation (eMudhra)` / `Draft Incorporation Docs` / `Other attachments (optional)`.

Recommendation for Phase 1: `RequiredInput.tabId` should carry the **section label string** (matching the `section:` value), and the step page should resolve it to an index at render time.

## 5. Deep-link support

**None.** No `useSearchParams` / `?tab=` in any step view. Tab state is `selectedSectionIndex` in `useMilestoneResponseFormState.tsx:698`, reset to 0 on step change (`:699-701`), passed to `InternSectionHeadingNav` via `MilestoneResponseFormSections.tsx:99-107`. Phase 3 must add a `?tab=<section label>` read there. Existing query params at step level: `?step=` (`project-step-path.ts:107-111`) and `?phase=` (`shell-crumbs.ts:334`) on the client list page only.

## 6. Step page layout

- Routes: intern `app/app/intern/engagements/[id]/step/[stepId]/page.tsx` (segment is `[id]`, not `[slug]`), manager `app/app/manager/projects/[slug]/step/[stepId]/page.tsx`, admin `app/app/admin/projects/[slug]/step/[stepId]/page.tsx`, client `app/app/client/incorporation/step/[stepId]/page.tsx`. All render `src/views/engagement/EngagementStepDetail.tsx` (via `EngagementStepDetailClient`, `ssr: false`).
- Rail: `ChecklistJourneyRail` (`src/components/incorporation/ChecklistJourneyRail.tsx:124`), phase-scoped instance `internPhaseRail` at `EngagementStepDetail.tsx:429-465`. **The rail card goes directly under it.**
- Layout grid `EngagementStepDetail.tsx:485`: `grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18.5rem)]`; form left, rail right.
- H1 row: `stepTitleRow` `:365-372` (`PageBackButton` `:367`, `<h1>` `:368-370`). **The narrow header button goes here.**
- Breakpoint: rail is `hidden lg:block` (`:430`), so it disappears below 1024px with no drawer. The header button must show at `lg:hidden`.
- Both intern and staff take the same branch (`internWorkspace` is always true, `:361`); the older left-rail layout at `:493-512` is unreachable.
- Path helpers: `staffProjectBase(baseOrRole)` `src/lib/project-step-path.ts:26-31`, `adminProjectPath(project, baseOrRole)` `:49-55`, `adminProjectStepPath` `:58-66`, `internEngagementPath` `:79-81`, `internEngagementStepPath` `:84-91`; `useStaffBasePath()` `src/hooks/use-staff-base-path.ts:11-14`.

## 7. Overview phase rows

One shared component for intern, staff and client: `InternPhaseEntryCards` `src/components/incorporation/InternOverviewProgress.tsx:107-172`. Row `<Link>` markup `:134-167`; the copy stack `:145-149` (title, subtitle, `metaForPhase` slot at `:148`) is the natural place for the "Documents ready/total" pill. Used by intern `src/views/admin/EngagementDetail.tsx:310-315`, staff `src/views/admin/ProjectDetail.tsx:148-153`, client `src/views/client/Incorporation.tsx:200`. The pill must be suppressed for the client viewer.

## 8. Zip

No `jszip` / `archiver` / `adm-zip`. `pizzip` `^3.2.0` is already a dependency (`package.json:62`) and is used for docx read/write in `docx.ts`, `docx-sanitize.ts`, `board-resolution-docx.ts`. PizZip can build a zip in memory (`new PizZip(); zip.file(name, buf); zip.generate({ type: 'nodebuffer' })`). No new dependency is needed for Phase 2.

## 9. Existing download pattern

All document routes stream bytes directly; none presigns:

- `app/api/engagements/[id]/incorporation-docs/download/route.ts`, `…/board-resolution/download/route.ts`, `…/board-resolution/download-signed/route.ts`, `…/dir-2/download/route.ts`.
- Pattern: `requireAnyRole(...)` → `assertEngagementBoardResolutionAccess(ctx, param)` (`src/lib/api/board-resolution-access.ts:13-34`, wraps `assertEngagementAccess` in `src/db/repositories/engagements.ts:383-422`: admin/super unrestricted, manager by ownership, intern by `internId` or `engagement_leads`, client by owner or `engagement_clients`) → bytes from `getObjectBuffer` → sanitise → `new NextResponse(new Uint8Array(buf), { headers })`.
- Headers: `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `Content-Disposition: attachment; filename="…"`, `Cache-Control: private, no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, `Expires: 0`.
- `signedDownloadUrl` (`src/storage/s3.ts:76-86`) is used only by milestone-document, documents and knowledge-bank signed-url routes.
- Preview: the app renders docx in the browser with `docx-preview` (`renderAsync`, `IncorporationDocxPreview.tsx:5`) fed by the download URL. The pack page can reuse `IncorporationDocxPreview` pointed at the pack item URL; no server-side preview format exists.
- The incorporation download route still hardcodes `VALID_AUDIENCES` to the three legacy strings (`route.ts:27`), consistent with the generators.

## 10. Audit helper

`recordAuditEvent(ctx, { engagementId, action, summary, metadata, actorEmail, actorName })` in `src/db/repositories/audit-events.ts:47-78`; best-effort, never throws. Action naming is dotted `noun.verb`: `incorporation_docs.generate`, `incorporation_docs.share_all`, `board_resolution.finalize`, `client.invite`, `knowledge_bank.upload`. Pack actions `doc_pack.download` / `doc_pack.download_zip` fit. **No download route writes an audit event today**; only generate and share do.

## 11. Bug check: `/app/intern/engagements/sampada-mintup/step/name-application`

Not a resolver bug and not a fallback. Step routes are keyed by **slug**, and `pre-1` "Client Details" owns `slug: 'name-application'` (`src/data/checklist.ts:141-145`). The step titled "Name Application" is `pre-4` with slug `name-application-filing` (`:205-209`). `resolveChecklistItemFromStepParam` (`src/lib/slug.ts:56-63`) matches slug first, so the URL correctly renders Client Details and highlights it in the rail (`EngagementStepDetail.tsx:169-173,444`). No fallback-to-current-step exists on this route; unresolvable steps redirect to the project page (`:261`). The collision is already documented in `src/components/shell/shell-crumbs.ts:321-324` with regression tests. Cause: a slug/title namespace collision in the catalog. Fix options (not applied): rename `pre-1`'s slug with an alias in `STEP_ALIASES` (`slug.ts:46-54`), or leave it.

---

## 12. Where the context file no longer matches the repo

1. **Step list.** §3 item 4 asks for "12 SPICe+ steps (Part A 1–5, Part B 6–12)" with tabs inside "Director KYC". Since the Part B restructure (2026-09-16) Part B is `pre-13, pre-14, pre-15, pre-16, pre-7 … pre-12` (10 steps) and `pre-6` is legacy-only. Director inputs live in the `pre-15` repeat group, so missing-input links for director fields should target `pre-15` (entry card), not a Director KYC tab.
2. **Tab ids.** `RequiredInput.tabId` assumes stable ids. Tabs are label strings with positional DOM ids, and Part A's tab set varies by ownership type. Use the section label as `tabId`.
3. **No `?tab=` support** exists (§3 item 5, §11 "only if missing"). Phase 3 must add it.
4. **Per-subscriber expansion** (`expandsPer: 'subscriber'`) has no counterpart: no generator reads `pre-16`, and the subscription sheets always use the first non-resident director. The registry can only declare what exists today (rule 6), so `expandsPer` is `'director'` or absent in Phase 1.
5. **Per-director expansion is limited to two audiences** (`non-resident`, `resident`). A third director gets no DIR-2 / DIR-8 / INC-9 today. The pack will show exactly what the generators produce; widening is the workbook task (`docs/incorp-doc-pack-context.md`, §10 of the context).
6. **Pre-7 completion depends on generated draft paths** (§3, `PRE7_REQUIRED_FILE_IDS`). Phase 5c (retire the Pre-7 panel) cannot simply remove the panel: either the pack route must keep writing `*DraftUrl` paths on download, or the pre-7 validator must stop requiring them. This needs the owner's call at the Phase 5 checkpoint.
7. **Generate has a validation gate** the pack does not: directors must be accepted (`pre-15.reviewStatus === 'accepted'`). The pack evaluator should treat "directors not yet accepted" as a required input, otherwise "ready" in the pack could still 422 on generate.
8. **Intern route segment is `[id]`**, not `[slug]` as §6 of the context writes; the value is still the engagement slug.
9. **Inline edits are not visible to a fresh generate.** The pack generates on demand from state (rule 7), so any inline edits made in the Pre-7 preview (stored as a patched object at a new S3 key) would not appear in a pack download. This is a product decision to flag, not a bug.
10. `docs/incorp-doc-pack-context.md` (2026-09-20) described the Part B restructure as "paused at Phase 0". Its §3 was rewritten on 2026-09-22 (`docs: update incorp doc pack context after Part B restructure`).

Owner decisions on these points are recorded in `docs/DOC-PACK-CONTEXT.md` §12.

## 13. Debt logged, not fixed

- **Orphaned Pre-7 S3 objects.** Every generate and every inline edit writes a new timestamped object under `milestone-documents/{engagementUuid}/{draftUrlField}/` and repoints the response key; the previous object is never deleted (`src/lib/api/incorporation-docs-generate.ts:146,173`). Storage grows by one docx per regenerate. A cleanup would need a repository-level "delete previous path on repoint" or a periodic sweep of keys not referenced from any `checklist_state`. Out of scope for the document pack.
- **BR draft download by staff.** `app/api/engagements/[id]/board-resolution/download/route.ts` serves a draft to any staff role. The pack must not rely on that route; it checks `status === 'finalized'` itself and never serves a draft.
