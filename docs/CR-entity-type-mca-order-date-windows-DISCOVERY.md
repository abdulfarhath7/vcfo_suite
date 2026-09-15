# Phase 0 — Discovery report: entity-type intake, MCA-ordered Part A, manager date windows, compliance gating

Companion to `CR-entity-type-mca-order-date-windows.md`. Read-only pass over the repo at
`dd9f453` (2026-09-15). No code written in this phase.

**Headline for §8 Q1:** the "dependent / independent" concept already exists as of
`dd9f453` — `engagements.ownership_type` (`subsidiary` | `independent`, migration 0018),
asked first on the create-project form as **Company type: Dependent / Independent**.
Phase 1 should reuse it, not add `entity_dependency`. The older `company_type`
(`domestic` | `foreign`) is a different axis (FEMA track) and stays.

---

## 1. Where entity type lives today

| Concept | Where | Exact names | Notes |
|---|---|---|---|
| Dependent / Independent | `engagements.ownership_type` text NOT NULL DEFAULT `'subsidiary'` (migration `0018_yielding_young_avengers.sql`) | Domain `OwnershipType = 'subsidiary' \| 'independent'` (`src/data/engagements.ts`), `Engagement.ownershipType`, API `ownershipTypeSchema` (`src/lib/api/schemas.ts`), form state `CreateProjectState.ownershipType` | UI label "Company type", options **Dependent** ("Subsidiary of a parent entity") / **Independent** ("Standalone — no parent entity"), first control in Entity details above "Where should work start?". Existing rows default to `subsidiary`. |
| Domestic / Foreign | `engagements.company_type` text NOT NULL DEFAULT `'domestic'` | `CompanyType = 'domestic' \| 'foreign'`, form label "Parent entity origin" (was "Entity origin") | `foreign` = overseas parent → FEMA / TP / STPI calendar rows (`deadlineAppliesTo` in `src/data/statutory-calendar-fy2627.ts`: `companyType === 'foreign' \|\| Boolean(parentEntityName)`). Hidden and forced `domestic` when Independent. |
| Parent entity (create form) | `engagements.parent_entity_name`, `parent_entity_address` (both nullable text) | `CreateProjectState.parentEntityName / parentEntityAddress`; "Parent company details" block in `CreateProjectFormSections.tsx` | Required only when Dependent (`createProjectBodySchema` superRefine). `parent_entity_registration_number` column exists but the create form does **not** collect it — only PATCH `/api/engagements/:id` and Part A do. |
| Subsidiary (create form) | `engagements.subsidiary_legal_name`, `subsidiary_registered_address` | "Subsidiary company details" block | Required when start stage is Registration or Compliance **and** Dependent (`stageRequiresSubsidiary(stage, ownershipType)`). Existing bug-guard intact. |
| Mapping verdict | — | — | **Reuse `ownership_type` as the CR's `entity_dependency`.** It carries exactly "a parent entity is incorporating this company" vs "standalone". |

## 2. Where foreign entity details and proof are captured today

| Item | Value |
|---|---|
| Step | `pre-1` "Client Details" (SPICe+ Part A, `responsibleRole: 'client'`) |
| Sections | **Foreign Entity**: `parentEntityName*`, `parentEntityRegistrationNumber*`, `parentEntityAddress*`, `parentEntityHasTrademark`, `parentEntityTrademarkUrl` (shown when trademark = yes). **Foreign Entity Proof**: `certificateOfIncorporationUrl*` (file). |
| Field definitions | `CLIENT_RESPONSE_FIELDS['pre-1']` in `src/lib/checklist-responses.ts` (lines ~30–486) |
| Storage | `engagements.checklist_state['pre-1'].responses.{key}` (jsonb). Text values as strings; the proof is the **S3 object key** `{engagementDbId}/{fieldId}/{ts}-{sanitisedName}` in bucket `milestone-documents` (`milestoneDocumentObjectPath`, `src/lib/milestone-document-storage.ts`), uploaded via `POST /api/engagements/:id/milestone-documents` (multipart, any role with engagement access). |
| Vault index | When a **staff** member uploads, the route also inserts a `documents` row (`createDocument`, `stepId = pre-1`, `category = section`). Client uploads write the key into responses only. Vault reads both (`collectVaultDocuments` from responses + `/api/documents` index, de-duplicated by object key). |
| Prefill | `applyPre1EngagementDefaults` copies `engagements.parent_entity_name / _address / _registration_number` into an empty Part A draft (`src/lib/checklist-pre1-validation.ts`). |
| Today for Independent (`dd9f453`) | Both sections (plus Authorized Signatory, Signatory KYC, `boardResolutionDate`) are dropped from Part A by `fieldsForOwnership` / `isParentEntityField` (`src/lib/checklist-responses.ts`) — form, client preview, rail attachments and `validatePre1Responses(…, { independent })`. Dependent unchanged. |
| Downstream readers of the parent fields | `src/lib/incorporation-docs/parent-entity.ts` (`resolveParentEntityName/Address/Registration` — Part A first, engagement row fallback) → used by `authorisation-letter.ts`, `subscription-sheet.ts` (MOA/AOA subscriber = parent), `board-resolution.ts` (board resolution docx). `authorisation-letter` also accepts the NR director passport number (Pre-6) in place of the parent registration number. |

**Phase 1 implication:** the read-side accessor the CR asks for already half-exists
(`resolveParentEntity*` = Part A responses → engagement row). Phase 1 would flip the
priority (row first, Part A legacy fallback), add `parent_entity_registration_number`
and a proof key to the create form, and stop asking them in Part A for Dependent too.
The proof key has no column today — needs either `engagements.parent_entity_proof_key`
or the `foreign_entity` jsonb the CR suggests.

## 3. Part A section tabs

| Item | Value |
|---|---|
| Step | `pre-1` |
| Tab source | Field `section` strings on `CLIENT_RESPONSE_FIELDS['pre-1']`; grouped by `groupFieldsBySection` → `internNamedSectionGroups` (`src/views/incorporation/milestone-response-form-utils.ts`). **Order = field array order in `checklist-responses.ts`.** There is no separate tab config. |
| Tab strip | `InternSectionHeadingNav` (rendered from `MilestoneResponseFormSections.tsx`), selection state `selectedSectionIndex` in `useMilestoneResponseFormState.tsx` (index into the *visible* group list; transient UI state only). |
| Submit = last tab | `internFormNextTarget` / `internSectionFooterAction(selectedIndex, groupCount)` resolve "last **visible** section" — already count-based, not `index N` hard-coded. |
| Current order (Dependent) | Foreign Entity → Foreign Entity Proof → Authorized Signatory → Signatory KYC → Proposed Company Names → Company Mail ID → Company Mobile Number → Business Description → Proposed Directors → Share Capital Details → (step remarks tab, labelled with the step title) |
| Current order (Independent, `dd9f453`) | Proposed Company Names → Company Mail ID → Company Mobile Number → Business Description → Proposed Directors → Share Capital Details → remarks |
| Responses keyed by | **field id**, never tab index (`responses[field.id]`; `getChangedPartial(fields, draft, saved)` diffs by id). Reordering tabs cannot corrupt saved data. **Phase 4 pre-check: passed.** |
| Completion | Tab ticks = `isSectionFieldsComplete(group.fields, values, liveValidationErrors)` per visible group; step Submit validity = `validatePre1Responses` (id-based, ownership-aware). No fixed "N sections" count anywhere → Independent can complete Part A. **Phase 2 pre-check: passed.** |
| Non-tab layouts | Client record view and `Pre1SectionCard` accordion use the same grouped list; `premiumSectionIndex` numbers sections by first appearance (display only). |

## 4. Signatory KYC fields and their readers

| Field id | Section | Type | Required by | Read downstream by |
|---|---|---|---|---|
| `signatoryFirstName`, `signatoryMiddleName`, `signatoryLastName` | Authorized Signatory | text | `PRE1_BASE_REQUIRED_TEXT_IDS` (first/last) | `resolveSignatoryDisplayName` (`src/lib/person-name.ts`) → **authorisation letter** `SIGNATORY_NAME`; **board resolution** docx; `board-resolution-errors.ts` missing-field labels |
| `signatoryDesignation` | Authorized Signatory | text | required | authorisation letter `SIGNATORY_DESIGNATION`; board resolution |
| `signatoryGender` | Authorized Signatory | select | required + `isValidPre1Gender` | none |
| `passportUrl`, `drivingLicenseUrl`, `utilityBillUrl` | Signatory KYC | file | `PRE1_REQUIRED_FILE_IDS` | **no generator reads them** — upload evidence only (vault / attachments menu) |
| `certificateOfIncorporationUrl` | Foreign Entity Proof | file | `PRE1_REQUIRED_FILE_IDS` | none (evidence only) |

Validator: `validatePre1Responses` in `src/lib/checklist-pre1-validation.ts`; all of the
above are skipped when `{ independent: true }` (since `dd9f453`).

DIR-2, DIR-8, INC-9, MOA, AOA, PAN undertaking, acceptance letter read **Pre-6 director
data**, not Part A signatory fields. The only Part A signatory consumers are the
**authorisation letter** and the **board resolution** — both parent-entity documents,
so for an Independent company they are N/A along with pre-2/pre-3. **§8 Q2 answer:
nothing needs a substitute source; the two consumers do not apply to Independent.**

## 5. Existing date / SLA logic

| Concern | Where | How |
|---|---|---|
| Playbook SLA copy | `ChecklistItem.expectedTimeline` (string, e.g. "2 working days") in `src/data/checklist.ts`; `getChecklistStepTimelineLabel(item)` falls back to `formatTimeline(item.deadline)` | Intern surfaces hide it: `hideTimeline` on `StepDetailContent` and the journey rail; `copyMentionsWorkingDaysSla` filters help text. Admin/client still see it. |
| Statutory deadline rules | `ChecklistItem.deadline: DeadlineRule` (`days-from-incorporation`, `fixed-window-weeks`, `estimated-weeks`) → `computeDueDate(rule, incorporationDate)` (`src/lib/deadlines.ts`) | Returns `null` before COI, so pre-inc steps never get a computed due date. |
| Step overdue | `buildInternQueue` (`src/lib/intern-dashboard.ts`): `isOverdue = status === 'overdue' && current` — the slice status `overdue` is a manual/legacy `StatusCode`, no automatic writer. `buildInternWorkItems` (`src/lib/intern-work.ts` ~L515) adds `dueAt < today` from `computeDueDate`. Both only on the current (active/waiting) step — locked steps never badge. | Matches the CR's "overdue on current step only". |
| Manager-set windows | **none exist** (no schedule key in `checklist_state`, no columns) | Reserved-key idea fits `ITEM_META_KEYS` handling: `normalizeEngagementChecklistState` keys the blob by item id, so a `schedule` top-level key would need explicit normaliser support (it currently treats every top-level key as an item). |
| Compliance instances | `compliance_instances` table (`src/db/schema.ts` ~L568): `due_date` NOT NULL, `period_*`, `status`, `owner_id`, `filed_on`; **no window columns** | Generated by Inngest `complianceGenerate` (cron `0 6 * * *`, `src/jobs/compliance-generate.ts`) → `systemGenerateComplianceInstances` → pure `generateComplianceInstances` → `upsertComplianceInstanceRows`. Upsert conflict target `(engagement_id, obligation_id, due_date, period_label)`; `set` touches only `period_start/end`, `fy_label`, `owner_id` (COALESCE). **New `window_from/window_to` columns left out of `set` survive regeneration** — satisfies the Phase 5 "job must not overwrite" rule with no extra code. |
| Client-side filings | `computeAllFilings` (`src/lib/compliance/compliance-store.ts`) recomputes instances in the browser from checklist triggers (`extractTriggersFromChecklist`: pre-12 `dateOfIncorporation`, reg-4 GST, reg-1 PF, reg-3 ESI, reg-2 TAN) — no window awareness. |

## 6. Lead's Compliance nav and Today queue

| Item | Value |
|---|---|
| Nav entry | `compliancesGroup('/app/intern')` in `RoleSidebar.tsx` (~L235), **unconditional** for the lead; leaves = `/app/intern/compliances/calendar`, `/filings`. Legacy `/app/intern/compliance` → `redirect('/app/intern/compliances/calendar')`. |
| Pre-COI handling today | `CompliancePages` → `useComplianceScope` → `preIncorporationIdsOf(engagements, getStateForEngagement)` (`src/views/compliances/compliance-scope.ts`) built on `isIncorporated` (`src/lib/compliance/incorporation-state.ts`) → shows `PreIncorporationNotice` instead of hiding. |
| `isIncorporated` today | `engagements.incorporation_date` set **or** pre-12 sequentially complete (`completed` / `not-applicable` / delivered). **Does not consult the start stage** — an engagement created at Registration / Compliance without an incorporation date reads as *not incorporated*. Phase 6 edge case is real; the predicate needs `stage !== 'Pre-Incorporation'` as a third rule (or the create form must capture the COI date for those starts). |
| Today queue | `useInternPortfolio` (`src/lib/use-intern-portfolio.ts`): `filings = useComplianceFilings(myEngagements, …)` → `computeAllFilings` → `buildInternWorkItems({ engagements, filings, requests })`. Filings become `source: 'filing'` work items (KPI `dueWeek.filings`, board column by due date). **Compliance items can appear on Today today** — but only when a trigger date exists (COI or a registration date), so in practice pre-COI engagements produce none unless a registration date was typed early. Phase 6 should still filter by `isIncorporated` explicitly rather than rely on that. |
| Engagement overview | `InternEngagementOverview` shows the four phase rows only; there is no compliance section on it to hide. |

---

## Contradictions with `CLAUDE-CONTEXT.md` / the CR

- CR Phase 1 assumes `entity_dependency` is new. It is not — `ownership_type` shipped in
  `dd9f453` with the create-form picker in the position the CR wants.
- CR-2 (Signatory KYC hidden for Independent) is already in `dd9f453`, including the
  Authorized Signatory section and `boardResolutionDate`, and pre-2/pre-3 are seeded N/A
  for Independent. Phase 2 reduces to "put the section list behind one
  `partAsectionsFor(ownershipType)` helper" if the owner still wants that shape.
- CR Phase 6 says lead nav should hide; the codebase deliberately shows a
  `PreIncorporationNotice` for every role instead (STATE.md "Compliance visible pre-COI").
  Phase 6 flips that for the lead only.
- CR Phase 5 storage ("reserved `schedule` key in `checklist_state`") clashes with
  `normalizeEngagementChecklistState`, which treats every top-level key as a step id.
  Either whitelist the key there or store the schedule in its own jsonb column.

## §8 — what the owner must answer before Phase 1

1. **Q1 mapping** — confirm: Dependent/Independent = `ownership_type` (exists). Keep
   Domestic/Foreign as the parent's origin for Dependent only.
2. **Q2 signatory source for Independent** — discovery says none needed (only the
   authorisation letter and board resolution read it; both are parent documents, N/A for
   Independent). Confirm.
3. **Q3 NIC digits** — MCA SPICe+ Part A takes the **5-digit** NIC-2008 main-division
   code in practice. Confirm 6 vs 5, and free-text-with-validation vs master list.
4. **Q4** one incorporation window (Part A + B) or one per part.
5. **Q5** client sees windows? (default no)
6. **Q6** windows replace the working-days SLA copy, or sit alongside it.
7. **Q7** bulk window assignment for the 23 registrations, or per-registration.

Also for Phase 1: does the firm actually hold the foreign entity proof at project
creation (CR §9 risk)? If not, keep the proof upload in Part A for Dependent and move
only the text fields.
