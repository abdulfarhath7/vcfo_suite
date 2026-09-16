# SPICe+ Part B restructure — build context

Companion to `CLAUDE-CONTEXT.md`. Read that first; it remains the source of truth for roles, the repository seam, email semantics, and the client sequential gate. This file overrides §4 of that document **for Part B only**, and amends Part A where noted.

This is an owner decision to change the catalog. The standing rule "do not invent checklist steps" still applies to everything not written down here.

---

## 0. Global rules

- Repository seam is sacred. Views never import `db`. All access through `src/db/repositories/*` with `AuthContext`.
- Code role `intern` = UI label **Project Lead**. Never render "intern".
- Autosave patches `{ responses }` only and **never emails**. Approval, Accept, Deliver and client-submit fan-out semantics are unchanged by this document.
- Board-resolution finalize semantics unchanged. Clients never see BR drafts.
- Status colour on chips and icons only, never page fill.
- Verification gate after each phase, reporting real numbers:
  ```
  npx tsc --noEmit > /tmp/tc.log 2>&1 && grep -c "error TS" /tmp/tc.log
  npx vitest run --reporter=dot
  npm run lint
  ```
- **Step ids are identifiers, not positions.** Never renumber or reuse an existing `pre-*` id. New steps get new ids. UI order comes from the phase `itemIds` array, never from a numeric `order` field — this is already true in the codebase and must stay true.

---

## 1. Part B — before and after

| # | Before (today) | After | Owner | Change |
|---|---|---|---|---|
| 1 | Director KYC (client) | **Capital structure** | see §5 | Director KYC **deleted permanently**; new step |
| 2 | KYC Review & DSC (lead) | **Registered office address** | see §5 | New step, auto-filled |
| 3 | Document Execution (client) | **Proposed directors** | see §5 | Moved out of Part A |
| 4 | SPICe+ Confirmation (client) | **Subscriber details** (optional) | see §5 | New step |
| 5 | SPICe+ Filing (lead) | **— unspecified —** | ? | **See §10 Q1. Blocking.** |
| 6 | MCA Remarks (lead) | **Document execution** | client | Existing step, moved, relabelled files |
| 7 | Certificate of Incorporation (lead) | **KYC Review & DSC** | lead | Existing step, unchanged except inputs |
| 8 | — | SPICe+ Confirmation | client | Unchanged |
| 9 | — | SPICe+ Filing | lead | Unchanged |
| 10 | — | MCA Remarks | lead | Unchanged |
| 11 | — | Certificate of Incorporation | lead | Unchanged |

The "before" column is positional only — the left and right rows are not counterparts.

---

## 2. New step specs

### B-1 Capital structure

Two share classes, **both optional**: **Equity** and **Preference**.

- Selection uses the **existing option-selection component** already used elsewhere in the app (entity type / legal form). Phase 0 identifies the canonical component; reuse it, do not build a second one. This is a design-drift rule, not a preference.
- Selecting a class reveals **quantity** and **amount** for that class. Deselecting hides and clears its fields.
- Neither class selected is a valid end state for this step. See §6.
- Quantity: positive integer. Amount: see §10 Q3 — per-share nominal value vs total is unresolved.

### B-2 Registered office address

- Auto-filled from data already captured earlier in the engagement. Phase 0 must report exactly where that address lives today (project creation form, Part A responses, or `engagements` columns) — do not guess a source.
- Auto-fill writes into the step's own responses on first open so the value is captured at this step, rather than being read live from the source at render time. A later edit to the source must not silently rewrite a value the client already confirmed here.
- **Editable by the filler.** An auto-filled field that cannot be corrected turns a data-entry error upstream into a blocked filing.
- Show provenance in quiet metadata: where the value came from.

### B-3 Proposed directors

- Moved wholesale from SPICe+ Part A. **Removed from Part A entirely** — the section, its fields, its validators, and its tab.
- Repeating list, add and remove — see §10 Q4.
- Field set is whatever Part A currently holds. Do not add or drop fields during the move. A move and a redesign in one commit is unreviewable.
- Existing engagements hold this data in the Part A step's responses. See §7.

### B-4 Subscriber details — **entire step optional**

Repeating list of subscribers. Each entry picks a type using the **same option-selection component** as B-1.

**Individual subscriber:** name · number of shares · value of shares

**Non-individual subscriber:** name · entity type → second selection: **Body corporate** or **LLP**

- **Body corporate:** name of the body corporate · CIN · address · authorised person · number of shares · value of shares
- **LLP:** name of the LLP · LLPIN · authorised person · number of shares · value of shares

Notes:
- **Authorised person is required for both** body corporate and LLP.
- The non-individual "name" and the type-specific "name of the body corporate / name of the LLP" look like the same field asked twice. See §10 Q2 — the recommendation is one name field that relabels by type.
- CIN and LLPIN get format validation, not a registry lookup.
- Optional means the client may submit this step with **zero subscribers**. See §6.

---

## 3. Removals

| Remove | From | Notes |
|---|---|---|
| **Director KYC** step | Part B catalog | Permanent. See §8 — this removes the only remaining client-side KYC collection point. |
| **Proposed directors** section | SPICe+ Part A | Section, fields, validators, tab entry. Data preserved, see §7. |
| **Certificate of Incorporation** | Document execution file list | The COI is *produced* at the final Part B step. Listing it as a document to execute was backwards. |

Deleting a step means removing it from the catalog and the phase `itemIds`. It does **not** mean deleting saved responses from `checklist_state` — see §7.

---

## 4. Document execution — file labels

| Current label | New label |
|---|---|
| MOA | **INC-33 — MOA (Memorandum of Association)** |
| AOA | **INC-34 — AOA (Articles of Association)** |
| — | **INC-35 — AGILE-PRO-S** (new entry) |
| Certificate of Incorporation | *removed* |

AGILE-PRO-S expands to: Application for Goods and services tax Identification number, employees state Insurance corporation registration pLus Employees provident fund organisation registration, Profession tax Registration, Opening of bank account and Shops and establishment registration. **Confirm the exact display string with the owner before shipping** — this is a long-form label that will appear in client-facing UI and in generated document names.

These are **label changes**, not identifier changes. Response keys, S3 object keys, and generator template names stay as they are. Renaming a storage key orphans every uploaded file.

---

## 5. Role ownership — unresolved

B-1 through B-4 need an owner role each, because ownership drives the sequential gate, who is emailed on submit, and whether the step appears on the lead's Today queue or the client's Inbox.

Working assumption, to be confirmed (§10 Q5): capital structure, proposed directors and subscriber details are **client** steps (the client supplies the facts); registered office address is a **client** step because it is a confirmation of auto-filled data. Document execution stays client. KYC Review & DSC stays lead.

If any of these are lead-owned instead, the client's Incorporation flowchart gets shorter and the lead's step workspace gets longer — say so explicitly rather than discovering it at demo.

---

## 6. Optional steps and the sequential gate — the trap

The client gate opens step N only when the previous active catalog item is **terminal**. An optional step with no input has no natural terminal state, so it will block every step after it forever.

Both B-1 and B-4 need an explicit terminal path:

- B-4 (wholly optional): submitting with zero subscribers is a valid submit and marks the step terminal. The submit control must remain enabled on an empty list, with copy that makes the choice deliberate — something like "No subscribers to add" rather than a bare greyed button.
- B-1 (both classes optional individually, but the step is not): at least one class must be selected, so the step terminates normally. Confirm this reading at §10 Q6 — if the owner means the whole capital step is skippable, it needs the same empty-submit path as B-4.

**Do not** solve this by auto-completing an untouched step. Auto-terminal steps silently skip themselves in the flowchart and the client never learns the question was asked.

---

## 7. Data model and migration

Everything here lives in `engagements.checklist_state` jsonb. **No new tables.**

- New steps get new keys. Repeating lists (B-3 directors, B-4 subscribers) are arrays of objects with a stable generated entry id per row, so an edit to row 2 cannot be misapplied to row 1 after a reorder.
- **Proposed directors move:** write a read-side accessor that returns the B-3 responses and falls back to the legacy Part A path when B-3 is empty. Do **not** run a destructive migration that moves and deletes. In-flight engagements must keep rendering.
- **Deleted Director KYC responses stay in `checklist_state`.** Orphan keys are harmless; deleting them is irreversible and there is no recovery if the owner reverses this decision.
- Completeness is computed from the **visible step list**, never a fixed count — the same rule established for Part A sections. Removing Director KYC and adding four steps changes the count; anything hardcoded breaks silently.
- Phase 0 must report whether any docx generator (DIR-2, DIR-8, INC-9, MOA/AOA) reads Director KYC or Part A proposed-directors responses. If yes, repoint it at the accessor in the same phase that moves the data.

---

## 8. Interaction with the earlier CR set — read before building

The previous change request removed the Signatory KYC section from Part A for **independent** entities, on the stated assumption that Part B's Director KYC step was the substitute collection point.

**This document deletes that step.** For an independent entity, the combined result is that no signatory or director KYC data is collected anywhere except whatever fields B-3 Proposed directors carries over from Part A.

That may be fine — if B-3 already holds DIN, PAN, and identity documents, nothing is lost and the two steps were duplicating each other. If B-3 holds only names and DINs, then **KYC Review & DSC has nothing to review**, and DSC issuance has no identity documents behind it.

Phase 0 must answer this before either change ships. Do not build both in parallel without it.

Second interaction: Part A section order was just reset to MCA portal order. Removing Proposed directors changes that list again. The order lives in **one** function (`partAsectionsFor`); update it there, never in a second place.

---

## 9. Execution phases

**Phase 0 — discovery (PAUSE).** No code. Report: the canonical option-selection component and its props · where the registered office address lives today · the exact Part A proposed-directors field set and its response keys · every generator reading Director KYC or proposed-directors data · how step completeness and the gate compute terminal state · the document-execution file list structure and whether labels and storage keys are the same string. Stop and get answers to §10.

**Phase 1 — removals.** Delete Director KYC from the catalog and phase `itemIds`; remove Proposed directors from Part A; remove COI from the document-execution list. Fix completeness computation. Verify an in-flight engagement still opens.

**Phase 2 — B-3 Proposed directors.** Add the step, move the field set unchanged, add the fallback accessor, repoint generators.

**Phase 3 — B-1 Capital structure and B-2 Address.** Both new steps, reusing the existing selection component. B-2 auto-fill on first open.

**Phase 4 — B-4 Subscriber details.** Repeating list, two-level type selection, empty-submit terminal path.

**Phase 5 — Document execution labels.** INC-33 / INC-34 / INC-35. Labels only.

**Phase 6 — Order, gate and integration.** Set the final Part B `itemIds` order, walk the full client gate end to end on a fresh engagement and on one created before this change, update `CLAUDE-CONTEXT.md` §4.

Commit at each phase. Phases 2, 3 and 4 touch different step definitions but the same catalog file — run them sequentially, not in parallel worktrees.

---

## 10. Open questions — blocking

1. **What is step 5?** The spec lists capital structure, address, proposed directors, subscriber details, then jumps to "the sixth step is document execution". Either there is a missing step or the numbering is off by one. Nothing can be ordered until this is answered.
2. **Non-individual name:** is the top-level "name" the same value as "name of the body corporate" / "name of the LLP", or two different things? Recommendation: one field, relabelled by type.
3. **Capital "amount":** nominal value per share, or total value for the class? SPICe+ works as shares × nominal value with the total derived. Recommendation: capture quantity and per-share value, compute the total.
4. **Repeating lists:** a real filing has multiple directors and multiple subscribers. Confirm B-3 and B-4 are add/remove lists rather than single entries.
5. **Role ownership** of B-1 to B-4 — see §5.
6. **Is B-1 as a whole skippable,** or is "both optional" only about choosing between equity and preference? This decides whether B-1 needs the empty-submit path.
7. **Document execution before KYC Review & DSC** — see §11, first risk. This ordering needs an explicit yes.
8. **AGILE-PRO-S display string** — confirm the exact client-facing label.

---

## 11. Risks

- **Document execution now precedes KYC Review & DSC, which is the step that generates the documents.** Today the lead generates DIR-2/8, INC-9 and MOA/AOA at KYC Review, and the client then executes them. In the new order the client is asked to execute documents that do not exist yet. Either the generation moves earlier, or document execution stays after KYC Review. This is the single most likely thing in this document to be a transcription slip rather than an intent.
- **Deleting Director KYC may leave the independent-entity path with no KYC source at all** — §8. Worst case is a DSC application with no identity documents behind it.
- **Optional steps and a sequential gate are natural enemies.** If the empty-submit terminal path is missed on B-4, every client on an engagement with no subscribers is permanently stuck, and it will present as "the portal is broken" rather than as a gating bug.
- **Part B roughly doubles in step count for the client.** Four new steps ahead of document execution is a longer wait before anything feels like progress. Worth a look at the Incorporation flowchart once the order is settled.
- **Renaming MOA to INC-33 in a storage key rather than a label** would orphan uploaded files. Labels only.
