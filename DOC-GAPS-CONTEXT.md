# VCFO Suite — Incorporation document gaps (Claude Code context)

Feature context for Claude Code. Read this whole file before touching code. Read `CLAUDE-CONTEXT.md` first if it is in the repo, then `docs/DOC-PACK-CONTEXT.md` and `docs/doc-pack/DISCOVERY.md` — this file only covers what those two left unbuilt.

Source of the requirement: the firm's master Excel workbook (`Incorporation_Excel.xlsx`, 14 sheets — one MASTER DATA page that auto-fills DIR-2, DIR-8, INC-9, ID & Address Declaration, Deposit Declaration, MBP-1 and an EPFO Specimen Signature card, per director). Audited against the repo on 2026-09-24.

---

## 1. What already exists (do NOT rebuild)

| Workbook document | App | Generator | Template |
|---|---|---|---|
| DIR-2 (per director) | ✅ | `src/lib/incorporation-docs/dir2.ts` | `public/templates/dir-2.docx` |
| DIR-8 (per director) | ✅ | `dir8.ts` (row loop `PRIOR_DIRECTORSHIPS`) | `dir-8.docx` |
| INC-9 (per director) | ✅ | `inc9.ts` | `inc-9.docx` |
| ID & Address Declaration | ✅ optional, DIN holders only | `declarations.ts` | `id-address-declaration.docx` |
| Deposit Declaration | ✅ optional | `declarations.ts` | `deposit-declaration.docx` |
| MBP-1 | ❌ | — | — |
| EPFO Specimen Signature card | ❌ | — | — |

Also existing and out of scope: board resolution, MOA, AOA, PAN undertaking, authorisation letter, acceptance letter, foreign MOA/AOA subscription sheets, the doc-pack read model (`src/lib/doc-pack/*`), the three doc-pack API routes (`app/api/engagements/[id]/doc-pack/…`), the pack page, rail card, header button, overview pill and step strip.

Every MASTER DATA input is already captured: company in `pre-1` / `pre-5` / `pre-14`; directors (name, father, DIN, DOB, PAN, Aadhaar, occupation, address, email, mobile, CS/COP no., other company interests) in the `pre-15` repeat group; signing date/place in `pre-7` (`incorpDocsSigningDate` / `incorpDocsSigningPlace`). Director audiences already expand to 6 slots per residency kind (`src/lib/incorporation-docs/audiences.ts`, `MAX_DIRECTOR_SLOTS_PER_KIND`), so a third director already gets DIR-2/8/INC-9.

---

## 2. What to build (the whole scope of this context)

| # | Gap | Why it matters |
|---|---|---|
| A | **MBP-1 — Notice of interest by director** (Section 184(1), Rule 9(1)), one per director | In the workbook. Tabled at the first board meeting after appointment → belongs to **`post-1` First Board Meeting**, not SPICe+. |
| B | **EPFO Specimen Signature card**, one per employer/director | In the workbook. Uploaded with the PF registration → belongs to **`reg-1` PF Registration**. |
| C | **Resident subscription sheet** | `public/templates/MOA & AOA Subcription Sheets Resident.docx` exists but is unreferenced; `subscriptionSheetVariantForDoc()` (`subscription-sheet.ts:72-77`) always returns `'foreign'`. An Indian-director-only company (the workbook's own example) currently gets the *foreign* sheet with the first non-resident director as subscriber — wrong document. |
| D | **Per-subscriber expansion + shares subscribed** | `pre-16` Subscriber Details is read by no generator. Share counts per subscriber never reach the subscription sheets or the MOA subscriber clause. Directors who subscribe themselves have no "shares subscribed" field at all. |

Nothing else. No new documents beyond A–D, no new MCA forms, no changes to the workflow semantics.

---

## 3. Global rules (apply to every phase)

1. **Repository seam is sacred.** Only `src/db/repositories/*` import `db`; only helpers/repos touch `src/storage/s3.ts`. Views → API routes → repositories taking `AuthContext`.
2. **Roles.** Documents A–D are staff-only (Project Lead = `intern` in code, Manager, Admin, Super Admin via shell). **Client gets 403** on every generation/download route and has no UI entry. Never render the word "intern".
3. **Do not edit lifted domain** — `src/data/checklist.ts` catalog entries, per-step validators, existing docx generators, compliance math — except where a phase below names the exact edit. Existing generators must stay **byte-identical** for existing inputs (parity test, Phase 6). Adding a field to a `pre-15` / `pre-16` repeat group is allowed only in Phase 4 and only as an *optional* field, so existing engagements and validators are unaffected.
4. **Generation is on demand from `checklist_state`.** No new table. No S3 write for generated output unless an existing pattern already stores it (Pre-7 `*DraftUrl` attach path). No email, no notification, no checklist status change from any generate/download. Audit-log downloads only, using the existing doc-pack audit helper and naming convention.
5. **Templates are docxtemplater `.docx` files in `public/templates/`**, registered in `INCORP_DOC_DEFINITIONS` (`src/lib/incorporation-docs/types.ts`) with a generator that exposes `*_MERGE_FIELD_KEYS` (and `*_LOOP_KEYS` for row loops) like `dir8.ts`. Follow `docx-validate.ts` / `docx-sanitize.ts` so the template check test passes. Never hardcode sample data in a template.
6. **Doc pack rule:** the pack page is the only place that previews/downloads generated documents. A and B are post-incorporation / registration documents, so they must **not** appear in the pre-incorporation pack's Part A / Part B counts — see Phase 2 for where they surface.
7. **Sequential gate untouched.** Nothing here changes client gating.
8. **Paths:** `staffBase` / `adminProjectPath(eng, roleOrBase)` / `useStaffBasePath`. Never hardcode `/app/manager`. Admin and manager share views — build once.
9. **UI:** existing primitives (`src/components/doc-pack/*`, `src/components/noir/*`, shadcn `src/components/ui/*`); status colour on chips/dots only; light + dark.
10. **Verification gate after every phase:** `npm run typecheck && npm run test && npm run lint`. Fix before moving on. Report deviations honestly.
11. **Commit at every phase** with the message given. Stop only at the ⛔ checkpoints.

---

## 4. Phase 0 — Discovery (read only) ⛔ checkpoint

Write `docs/doc-gaps/DISCOVERY.md`. No code changes. Answer, with file:line references:

1. `subscription-sheet.ts`: every place `variant` is decided or defaulted; how the sheet picks its subscriber; what the resident template's merge tags are (open the `.docx`, list tags) and how they differ from the foreign one.
2. `pre-16` repeat group: field ids for `subscribers` (type, entityType, name, cin, address, shares taken, nominee for INC-35…), how `repeatEntries()` reads them, and whether `pre-15` has any per-director share field (expected: none).
3. `pre-15` "other company interests": exact field ids (`otherInterest{n}{Part}` in `proposed-directors.ts`) and the parts available (company, CIN, nature, shareholding, from/to?). MBP-1 needs *nature of interest* and *shareholding %* — say whether they exist or must be added (Phase 4).
4. `post-1` First Board Meeting and `reg-1` PF Registration: their `infoRequired`, response fields, and how the step page renders a step with `forms: []` — where a "generated documents" panel would sit (compare the Pre-2 BR card and the Pre-7 generate panel in `Phase1StepPanelParts.tsx` / `Phase1StepPanelRoutePanels.tsx`).
5. Doc pack read model: how `DocDefinition.part` (`'part-a' | 'part-b'`) is consumed by the pack page filter, rail card and overview pill, and what breaks if a third value is added. Propose the least-invasive way to carry post-inc / registration documents (new `part` values `'post-inc' | 'registration'`, filtered out of the pre-inc surfaces vs a separate registry).
6. The template validation test (`templates.test.ts`) and what a new template must satisfy.
7. Signing date/place: confirm A and B can reuse `signingDate()` / `signingPlace()` from `shared.ts` (fed from `pre-7`) or need their own date source (post-inc docs are dated at the board meeting — check whether `post-1` captures a meeting date).

⛔ Stop and report. Wait for the owner's answers to the open questions in §10 before Phase 1.

---

## 5. Phase 1 — Resident subscription sheet (gap C)

Goal: an engagement whose subscribers are all resident individuals gets the resident sheet; a foreign-parent engagement keeps today's output byte-for-byte.

1. Implement `subscriptionSheetVariantForDoc(doc, ctx)` for real: `'foreign'` when any subscriber is a non-resident individual or a body corporate/LLP (foreign parent), `'resident'` otherwise. Decide from `pre-16` subscribers first; when `pre-16` is empty, from the proposed directors' `indiaResident` flag (directors subscribe themselves).
2. Register `public/templates/MOA & AOA Subcription Sheets Resident.docx` → copy to `moa-aoa-subscription-sheet-resident.docx`, strip sample data, add merge tags matching the foreign sheet's key set (`subscription-sheet.ts` `buildSubscriptionSheetMergeFields`). Add it to `templates.test.ts`.
3. `INCORP_DOC_DEFINITIONS['moa-subscription-sheet' | 'aoa-subscription-sheet'].templateRelative` becomes a function of the variant (or add a `templateFor(variant)` resolver used by `renderIncorpDocxBuffer`). Keep the `docSuffix` / draft field ids unchanged so Pre-7 attach paths still work.
4. Doc-pack `requiredInputs` for the two sheets: replace the unconditional `nonResidentLetterInputs(...)` with variant-aware inputs (resident variant needs each subscribing director's name, father's name, address, DOB — not "a non-resident director").
5. Tests: `subscription-sheet.test.ts` — foreign case unchanged (snapshot of merge fields), resident case picks the resident template and first resident director; doc-pack `evaluate` test — resident-only engagement shows the sheets as `ready` instead of `needs-inputs: A non-resident director`.

Commit: `feat(docs): resident MOA/AOA subscription sheet variant`

---

## 6. Phase 2 — Per-subscriber expansion and shares subscribed (gap D)

1. Add `expandsPer: 'subscriber'` to `DocDefinition` and a `DocPackSubscriber` in `types.ts` (`{ index, displayName, kind: 'director' | 'pre16', values }`). Build the list in `evaluate.ts`: `pre-16` entries, plus each proposed director when `pre-16` is empty or when a director is also marked as subscriber (see §10 Q3).
2. Subscription sheets render **one sheet per subscriber** (filename `moa-subscription-sheet-{n}.docx` for n>1), each with that subscriber's name, C/o father, address, DOB/CIN, **shares subscribed** and the amount (shares × `nominalValuePerEquityShare` from `pre-1`).
3. MOA subscriber clause: if `moa.ts` renders a subscriber table, feed it the same list (shares per subscriber, total = paid-up shares). If it does not, leave the MOA alone and say so.
4. Shares-subscribed input: `pre-16` already has a shares field per subscriber (confirm id in Phase 0). For directors subscribing themselves, add an **optional** `sharesSubscribed` field to the `pre-15` director repeat group (Phase 4 rules). Doc-pack `requiredInputs` points at it with a deep link.
5. Zip and pack page: multiple subscriber items list individually, same as director expansion.

Commit: `feat(docs): per-subscriber subscription sheets with shares subscribed`

---

## 7. Phase 3 — MBP-1 (gap A)

1. Template `public/templates/mbp-1.docx` (build it from the workbook's MBP-1 sheet — heading, Section 184(1) & Rule 9(1) citation, "To, The Board of Directors, {COMPANY}", director block, interest table, signature block, date/place). Merge keys, mirroring `dir8.ts`:
   `PROPOSED_COMPANY_NAME, DIRECTOR_FULL_NAME, FATHERS_NAME, DIRECTOR_ADDRESS, DIRECTOR_DESIGNATION, DIRECTOR_DIN, INTERESTS[] {SL_NO, ENTITY_NAME, NATURE_OF_INTEREST, SHAREHOLDING, DATE_OF_INTEREST}, DOCUMENT_DATE, DOCUMENT_PLACE`. One `NIL` row when the director has no interests.
2. Generator `src/lib/incorporation-docs/mbp1.ts` with `MBP1_MERGE_FIELD_KEYS`, `MBP1_LOOP_KEYS = ['INTERESTS']`, `buildMbp1MergeFields()` reading `directorOtherInterests(pre6, d)` (extend the interest parts only if Phase 0 says nature/shareholding are missing — Phase 4).
3. Register kind `'mbp-1'` in `INCORP_DOC_KINDS` / `INCORP_DOC_DEFINITIONS` (`directors: ['non-resident','resident']`, `docSuffix: 'Mbp1'`, filename `mbp-1-{who}[-n].docx`). Do **not** add its draft field to `PRE7_REQUIRED_FILE_IDS` — it is not a Pre-7 deliverable.
4. Doc pack registry entry with `part: 'post-inc'`, `sourceStepIds: ['pre-5', PROPOSED_DIRECTORS_STEP_ID, 'post-1']`, `expandsPer: 'director'`, `releaseGate: 'directors-accepted'`. Per Phase 0 item 5, the pre-inc pack page, rail card, header button and overview pill must keep showing only `part-a` / `part-b`.
5. Surface: a **"Board meeting documents" card on `post-1`** (same component as the doc-pack rail card, filtered to `part: 'post-inc'`) with Preview / Download per director + zip; and the pack page gains a "Post-incorporation" filter that is hidden when it has zero items. Date source per Phase 0 item 7.
6. Tests: merge-field snapshot for a director with 2 interests and with none; template validation; doc-pack evaluate shows `mbp-1` only under the post-inc part; client 403 on the item route.

Commit: `feat(docs): MBP-1 notice of interest per director on First Board Meeting`

---

## 8. Phase 4 — Optional input fields (only what Phases 2–3 proved missing)

Allowed edits to lifted domain, all **optional** (no validator change, no gate change):

- `pre-15` director entry: `sharesSubscribed` (number; label "Shares subscribed (if subscribing to the memorandum)"), `designation` (default "Director") if not already present.
- `pre-15` other-interest parts: `NatureOfInterest`, `Shareholding` if Phase 0 found them absent.
- `post-1`: `boardMeetingDate` if Phase 0 item 7 found no date source.

Keep the legacy `pre-6` suffix map in `proposed-directors.ts` in sync. Add each field to `checklist-responses.ts` and the Directors entry card; extend `proposed-directors.test.ts`.

Commit: `feat(directors): optional shares-subscribed, designation and interest details`

---

## 9. Phase 5 — EPFO Specimen Signature card (gap B)

1. Template `public/templates/epfo-specimen-signature.docx` from the workbook sheet: title line, establishment details, "Name of the Employer / Designation", three numbered signature boxes, "For PF office use". Merge keys: `ESTABLISHMENT_NAME, ESTABLISHMENT_ADDRESS, EMPLOYER_NAME, EMPLOYER_DESIGNATION`.
2. Generator `src/lib/incorporation-docs/epfo-specimen-signature.ts`; kind `'epfo-specimen-signature'`, `directors: ['non-resident','resident']`, filename `epfo-specimen-signature-{who}[-n].docx`. Establishment name = incorporated company name (`pre-12` COI name if captured, else `pre-5`); address = registered office (`resolveRegisteredOfficeResponses`, then post-inc `post-10` INC-22 address if changed).
3. Doc pack registry entry `part: 'registration'`, `sourceStepIds: ['pre-5','pre-14', PROPOSED_DIRECTORS_STEP_ID, 'reg-1']`, `expandsPer: 'director'`, `releaseGate: 'directors-accepted'`.
4. Surface: "Registration documents" card on **`reg-1` PF Registration** (same filtered rail card); pack page "Registration" filter, hidden when empty.
5. Tests as in Phase 3.

Commit: `feat(docs): EPFO specimen signature card per director on PF Registration`

---

## 10. Phase 6 — Parity, docs, cleanup ⛔ checkpoint

1. **Parity test:** for a fixture engagement using only pre-existing fields, every pre-existing document kind renders byte-identical before/after this work (hash the buffers; store expected hashes in the test fixture generated from `main` before Phase 1).
2. Update `docs/doc-pack/DISCOVERY.md` §12 items 4–5 (they are now stale) and add `docs/doc-gaps/STATE.md` listing what shipped, with routes and step ids.
3. Delete the unreferenced original template file only after the resident copy is registered and green.
4. Run the full gate, then a manual pass as `intern@vcfo.local`: pre-inc pack unchanged in count; `post-1` shows MBP-1 per director; `reg-1` shows the specimen card; resident-only fixture gets resident sheets; `client@vcfo.local` sees none of it.

Commit: `chore(docs): parity test, discovery refresh, template cleanup`

⛔ Stop and report: what shipped, deviations, anything from §11 still open.

---

## 11. Open questions for the owner (answer before Phase 1)

1. **MBP-1 placement** — on `post-1` First Board Meeting as proposed, or also pre-generated at Pre-7 so the firm can collect signatures with DIR-2/8/INC-9? (Workbook implies the latter is the firm's habit.)
2. **MBP-1 date** — board-meeting date, or the same signing date as the SPICe+ pack?
3. **Subscribers** — when `pre-16` is empty, do *all* proposed directors subscribe (equal split of paid-up shares), or must the lead enter `sharesSubscribed` per director? Which directors sign the specimen card — all, or only those the firm registers as "employers"?
4. **Resident sheet trigger** — is "no non-resident subscriber" the right rule, or should the lead choose the variant explicitly on Pre-7?
5. Should the pack page's Post-incorporation / Registration filters exist at all, or should those documents live only on their own steps?

---

## 12. Files you will touch (and not)

**Touch:** `src/lib/incorporation-docs/{types,subscription-sheet,docx,paths,mbp1,epfo-specimen-signature}.ts` · `src/lib/doc-pack/{types,registry,inputs,evaluate}.ts` · `src/lib/api/{doc-pack,incorporation-docs-errors}.ts` · `src/components/doc-pack/*` (filtered rail card) · `src/views/engagement/EngagementStepDetail.tsx` (card on `post-1` / `reg-1`) · pack page view · `public/templates/` (3 new docx) · `src/lib/proposed-directors.ts` + `src/lib/checklist-responses.ts` (Phase 4 only) · tests beside each.

**Do not touch:** `src/data/checklist.ts` step catalog entries (ids, order, gates) · `checklist-step-gate.ts` · board-resolution generate/finalize · `PRE7_REQUIRED_FILE_IDS` · email dispatcher / `notifyEngagementEvent` · any repository's role filter · Auth.js.
