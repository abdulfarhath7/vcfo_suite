# Phase 0 — Discovery: SPICe+ Part B restructure

Companion to `spice-part-b-restructure-context.md`. Read-only pass at `8e6035d`
(2026-09-16). No code written.

**Two findings change the plan before any phase can start — read §A and §B first.**

---

## A. The client does not type into steps any more

Since the visibility / approval work (2026-09-15, `checklist-visibility.ts`,
`isMilestoneFormReadOnly`): **a client never edits a checklist step.** Every step is
filled by the project lead, sent to the manager (Request approval / Submit), accepted, and
only then read — and Approve / Request-a-change'd — by the client.

So "client-owned" (`responsibleRole: 'client'`) today changes only:
- gate wording ("Waiting on the client…" vs "…project lead…"),
- who the step is *attributed* to on the client flowchart and Today,
- which email fan-out fires on submit.

It does **not** make the client the filler. §5's working assumption ("the client supplies
the facts") therefore means: the lead types what the client tells them, the manager
accepts, the client approves. The "empty submit" terminal path (§6) is a *lead* Submit with
zero subscribers → manager Accept → terminal. There is no client submit control to keep
enabled. Confirm this is acceptable (§10 Q5 becomes: attribution only).

## B. Deleting Director KYC removes every generator's input

`pre-6` Director KYC is the **only** source of the per-director KYC facts. It carries, per
director slot (NR / resident × up to 4): first/middle/last name, gender, DOB, father's
name, education, occupation, passport no. + copy, driving-licence no. + copy, utility-bill
type/no./address + copy, mobile, personal + official e-mail, photograph,
notary/apostille method, plus "existing interest in other companies" (up to 5 × 5 fields),
**Shareholder Details** (2) and **Registered Office Details** (5: complete address, NOC
upload, utility-bill type/no./copy).

Readers (`directorField(pre6, …)` via `src/lib/incorporation-docs/shared.ts`):
`dir2.ts`, `dir8.ts`, `inc9.ts`, `moa.ts`, `aoa.ts`, `subscription-sheet.ts`,
`pan-undertaking.ts`, `acceptance-letter.ts`, `authorisation-letter.ts`, `paths.ts`,
plus `IncorporationDocsGeneratePanel`, `Phase1StepPanel*` (pre-6 status),
`registered-office-responses.ts` (MOA registered office), `pre6-prefill-from-pre1.ts`.

B-3 as specified ("field set is whatever Part A currently holds") carries **only**
`directorCount` + per director: first/middle/last name, gender, India-resident yes/no,
DIN, has-DSC, DSC expiry. **No DOB, father's name, passport, address, photo, occupation,
e-mail, nationality.** After the deletion:

- DIR-2 / DIR-8 / INC-9 / MOA / AOA / subscription sheets / PAN undertaking /
  acceptance + authorisation letters all render `[placeholder]` for every KYC field.
- **KYC Review & DSC has nothing to review**; DSC issuance has no identity documents.
- The registered office (address + NOC + utility bill) disappears unless B-2 absorbs it.
- This applies to **dependent and independent** companies alike — §8's worry is not
  independent-only; it is everyone.

**Recommendation (needs a yes):** B-3 "Proposed directors" = one repeating entry per
director carrying the Part A fields **plus the pre-6 per-director KYC fields** (the
existing `nrDirector*` / `residentDirector*` field set, keyed by entry), and B-2 absorbs the
five Registered Office fields. Then pre-6 can go, generators are repointed once at the
accessor, and nothing is lost. If the owner wants B-3 to stay name-only, say which document
generation should be dropped.

---

## 1. Canonical option-selection component

| Item | Value |
|---|---|
| Component | `SegmentedPicker<T>` — `src/components/admin/SegmentedPicker.tsx` |
| Props | `value: T \| null`, `options: { value: T; label: ReactNode }[]`, `onChange(next: T)`, `ariaLabel?` / `labelledBy?`, `columns?` (default one per option), `size?: 'sm' \| 'md'`, `className?` |
| Used by | starting phase, Company type, Parent entity origin, Entity legal form, questionnaire Yes/No |
| Inside checklist steps today | **not used.** `select` fields render a Radix dropdown (`useMilestoneResponseFormState` → `Select`). B-1 / B-4 need a field type that renders `SegmentedPicker` inside a step: add `ChecklistFieldType 'segmented'` (or `ui: 'segmented'` on `select`) handled in the hook's `renderEditableField` and read-only record. One addition, then every step can use it. |
| Multi-select | `SegmentedPicker` is single-value. B-1 "Equity and/or Preference, both optional" is two independent toggles → two Yes/No pickers (`equityShares: yes/no`, `preferenceShares: yes/no`), each revealing quantity + value via `showWhen`. Existing `showWhen` supports exactly this. |

## 2. Where the registered office address lives today

| Source | Where | When it exists |
|---|---|---|
| `engagements.subsidiary_registered_address` (+ `subsidiary_legal_name`) | create/edit project form, "Subsidiary company details" | **only** when start stage is Registration / Compliance **and** company is Dependent |
| pre-6 "Registered Office Details": `registeredOfficeCompleteAddress`, `registeredOfficeNocUrl`, `registeredOfficeUtilityBillType`, `registeredOfficeUtilityBillNumber`, `registeredOfficeUtilityBillCopyUrl` | `checklist_state['pre-6'].responses`; accessor `resolveRegisteredOfficeResponses(pre6, pre8)` in `src/lib/registered-office-responses.ts` (legacy fallback to the same ids on pre-8) | when the lead fills Director KYC — **this is the step being deleted** |
| Part A | — | **no Indian registered office anywhere in Part A** (parent entity address only) |
| Read by | `moa.ts` (MOA registered office clause), `Phase1StepPanel*` (pre-6 summary) | |

**Consequence:** for an incorporation-start engagement there is **no earlier source** to
auto-fill B-2 from. B-2 must *be* the capture point (address + NOC + utility bill — SPICe+
INC-22 / AGILE-PRO-S need them), with `subsidiary_registered_address` as the only possible
seed (late starts). Provenance label: "From project setup" when seeded, else nothing.

## 3. Part A Proposed Directors — exact field set

Section `Proposed Directors` in `CLIENT_RESPONSE_FIELDS['pre-1']` (`src/lib/checklist-responses.ts`), 33 fields, **fixed slots 1–4, flat keys, not an array**:

| Key | Type | Required | Notes |
|---|---|---|---|
| `directorCount` | select 2–4 | yes | `parseDirectorCount`, `PRE1_MIN_DIRECTORS = 2`, `PRE1_MAX_DIRECTORS = 4`, default 2 |
| `director{n}FirstName` / `LastName` | text | yes | |
| `director{n}MiddleName` | text | no | |
| `director{n}Gender` | select | yes | `PRE1_GENDER_OPTIONS`, `isValidPre1Gender` |
| `director{n}IndiaResident` | select yes/no | yes | validator: **≥ 1 India-resident director** (`hasIndiaResidentDirector`) |
| `director{n}Din` | text | no | |
| `director{n}HasDsc` | select | no | |
| `director{n}DscExpiryDate` | date | when HasDsc = yes | `showWhen`, `isValidPre1Date` |

Code that knows these keys (all to move or repoint in Phase 1/2):
`checklist-pre1-validation.ts` (director loop, `PRE1_DIRECTOR_*_IDS`, `directorFieldsToClear`,
`getPre1VisibleFields` slot filter), hook `setDirectorCount` + the `directorCount`
segmented rendering (`useMilestoneResponseFormState.tsx` ~L825, ~L1236), `part-a-sections.ts`
(`proposedDirectors` in `PART_A_SECTION_ORDER`), `checklist-pre6-validation.ts`
`getPre6DirectorSlotsFromPre1` (pre-6 NR/resident slots derive from pre-1 residency),
`pre6-prefill-from-pre1.ts`, `aoa.ts` (director names + gender from pre-1),
`board-resolution.ts` (director lines from pre-1 count), `Phase1StepPanel*` (pre-1 summary).

Storage today: `checklist_state['pre-1'].responses.director{n}*`. B-3's array-of-entries
shape is new; the accessor must map legacy slots → entries (`director1*` → entry 0 …) so
in-flight engagements render.

## 4. Generators reading Director KYC / proposed directors

| Generator | Reads pre-6 | Reads pre-1 directors |
|---|---|---|
| DIR-2, DIR-8, INC-9, PAN undertaking, acceptance letter, authorisation letter | yes (`directorField`) | — |
| MOA | yes (+ registered office) | — |
| AOA | yes | yes (names + gender) |
| MOA/AOA subscription sheets | yes | — |
| Board resolution (pre-2 docx) | — | yes (director count / names) |
| `paths.ts` (draft object keys per director) | yes | — |

Repoint target: one accessor in Phase 2 that yields the director entries (with KYC fields
if §B is accepted) and the registered office.

## 5. Completeness and terminal state

| Mechanism | Where | Fixed count? |
|---|---|---|
| Sequential gate | `isChecklistStepSequentiallyComplete` (`checklist-step-gate.ts`): `completed` / `not-applicable` / delivered / client-submit lock / manager-accepted lead request; pending or rejected requests and reopened fields are not terminal | n/a |
| Phase progress + ticks | `phase.items` from `getIncorporationPhases()` → `INCORPORATION_PHASES[].itemIds` (`src/data/checklist.ts`) | **no** — visible list ✓ |
| Step Submit validity | `runStepValidation(itemId, …)` → per-id validators (`validatePre1/6/7/8/9/10/11/12Responses`); unknown ids → ok | per id |
| Section ticks | `isSectionFieldsComplete` on visible groups | no ✓ |
| Client tone | `derivePreIncStepTone` switch on `pre-1…pre-12`; unknown ids → `deriveClientOwnedStep` default | per id, safe default |
| Terminal for an "optional" step | lead Submit (`internLeadManagerRequestPatch`) → manager Accept → `status: completed` | validator must accept the empty case |

Other per-id hard-coding that a new/removed step must be checked against:
`PHASE1_PANEL_IDS` (`StepDetailContentSections` → `Phase1StepPanel` route panels, pre-2…12),
`PHASE2_STRUCTURED_STEP_IDS` (form styling), `INTERN_DELIVERY_STEP_IDS` (pre-4/5/7/10/11/12),
`PARENT_ENTITY_ONLY_STEP_IDS` (pre-2/3), `isPre1SubmittedForPre6` ("Phase 1 Step 1 required
first" gate on pre-6), `STEP_SLUGS` in `slug.ts` (`pre-6` → `director-kyc-details`),
`COI_ITEM_ID = 'pre-12'`, `isIncorporationWindowStep` (phase-based ✓), `checklist-notifications`
hrefs. Ids are identifiers: `order` on `ChecklistItem` is informational; UI order = `itemIds` ✓.

## 6. Document execution (pre-8) file list

`CLIENT_RESPONSE_FIELDS['pre-8']`, 19 file fields + remarks. **Label ≠ storage key**:
the S3 object path is `{engagementId}/{fieldId}/{ts}-{name}` and the response key is the
`fieldId`; the label is display-only. Relabelling is safe.

| Field id (storage key) | Current label | Required |
|---|---|---|
| `moaSubscriptionSheetSignedUrl` | Memorandum of Association (MOA) Subscription Sheet | yes |
| `aoaSubscriptionSheetSignedUrl` | Articles of Association (AOA) Subscription Sheet | yes |
| `certificateOfIncorporationSignedUrl` | Certificate of Incorporation | **yes** — `PRE8_REQUIRED_FILE_IDS` in `checklist-pre8-validation.ts`; removal must drop it there too |
| `boardResolutionSignedForIncorpUrl`, `authorisationLetterSignedUrl`, `acceptanceLetterSignedUrl` | … | yes |
| `{nr,resident}Director{Passport,DrivingLicence,UtilityBill,Dir2,Dir8,Inc9}SignedUrl` | "… (self-signed)" | yes |
| `nrDirectorPanUndertakingSignedUrl` | PAN undertaking | no |

There is **no plain "MOA" / "AOA" entry in pre-8** — the executed items are the subscription
sheets. Plain MOA/AOA labels live in the **draft** list (pre-7 `moaDraftUrl` / `aoaDraftUrl`)
and in `src/lib/incorporation-docs/types.ts` (`label: 'MOA'`, `'AOA'`, `'MOA Subscription
Sheet'` …) which drives the client's download panel and generated file names. INC-35
AGILE-PRO-S has no entry anywhere today (new field id needed, e.g. `agileProSSignedUrl`).
Confirm which list §4's INC-33 / INC-34 relabel targets: the pre-8 subscription sheets, the
pre-7 drafts, or the `types.ts` doc labels (which also name generated files).

---

## Answers / contradictions for §10

1. **Step 5** — not derivable from the repo. Given §11's first risk, the coherent order is:
   B-1 Capital → B-2 Address → B-3 Directors → B-4 Subscribers → **KYC Review & DSC**
   (generates) → **Document execution** (client signs) → SPICe+ Confirmation → Filing → MCA
   Remarks → COI. That makes "step 5" KYC Review & DSC and moves Document execution to 6 —
   i.e. the two existing steps keep their current relative order. Needs a yes.
2. Non-individual name: recommend **one** `name` field relabelled by type (matches the
   `relabel` pattern possible with `showWhen`).
3. Capital amount: recommend quantity + **nominal value per share**, total derived and shown
   read-only (same pattern as `nicBusinessType`). Pre-1 already holds
   `authorisedShareCapital`, `paidUpShareCapital`, `nominalValuePerEquityShare` — B-1 should
   either replace those or be seeded from them; say which.
4. Repeating lists: the form engine has **no array fields today** (pre-6 uses fixed slots
   1–4 with `showWhen`/count). B-3 and B-4 need a new `repeat` field kind (entries with
   generated ids) in `useMilestoneResponseFormState` + record view + validators. This is the
   largest single piece of work in the CR.
5. Ownership: see §A — attribution only. Recommend all four B-1…B-4 `client` (client
   approves after manager accept), KYC Review & DSC `intern`, Document execution `client`.
6. B-1: recommend "at least one class" (step not skippable) — matches the spec text.
7. Document execution before KYC Review: **treat as a transcription slip** (see 1).
8. AGILE-PRO-S label: needs the owner's exact string.

## Files to touch per phase (preview)

- P1: `src/data/checklist.ts` (catalog + `INCORPORATION_PHASES`), `checklist-responses.ts`
  (Part A directors, pre-8 COI), `part-a-sections.ts`, `checklist-pre1-validation.ts`,
  `checklist-pre8-validation.ts`, `slug.ts`, `StepDetailContentSections` panel ids, hook.
- P2: new step + `repeat` field kind + accessor `src/lib/proposed-directors.ts` + generator
  repoint (`shared.ts` `directorField`).
- P3: `segmented` field kind, B-1 / B-2 field defs + validators, B-2 seed from
  `subsidiary_registered_address` on first open (write-through, provenance).
- P4: B-4 defs, nested type selection, empty-submit validator path.
- P5: labels only.
- P6: `itemIds` order, `CLAUDE-CONTEXT.md` §4.
