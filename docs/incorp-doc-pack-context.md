# Incorporation doc pack — build context

Companion to `docs/claude-briefing/CLAUDE-CONTEXT.md` and `docs/spice-part-b-restructure-context.md` (landed 2026-09-16). Read both first.

**Goal:** the firm's Excel workbook (one master sheet, every director form filled by formula) becomes a first-class feature of the app. Enter data once, generate the whole pack for every director, download it in one click, client signs and uploads.

**Scope is the gap only.** Most of this already exists. Do not rebuild it.

---

## 0. Global rules

- Repository seam is sacred. Views never import `db`. Only helpers and repositories touch `src/storage/s3.ts`.
- Code role `intern` = UI label **Project Lead**. Never render "intern".
- Autosave patches `{ responses }` only and never emails. Approval, Accept, Deliver, share-to-client and board-resolution finalize semantics are unchanged by this document.
- Everything lives in `engagements.checklist_state` jsonb. **No new tables. No new checklist steps.**
- `src/lib/incorporation-docs/*` is lifted, tested domain code. Every change in it lands with a test. Existing tests stay green without edits unless this document says a behaviour changes.
- **Zero-migration rule:** every response key, row key and S3 object path that exists today keeps resolving. An engagement with one non-resident and one resident director must behave byte-for-byte as it does now after every phase.
- **PII:** the repo is public. Test fixtures use obviously fake data only (`ABCDE1234F`, DIN `01234567`, `Test Director One`). Never commit the firm's Excel workbook or any real PAN, Aadhaar, DIN, address or phone number. No template prints Aadhaar.
- Verification gate after each phase, reporting real numbers:
  ```
  npx tsc --noEmit > /tmp/tc.log 2>&1; grep -c "error TS" /tmp/tc.log
  npx vitest run --reporter=dot
  npm run lint
  ```
- Commit at each phase with the message given. Do not stop for permission between phases except at the marked PAUSE.

---

## 1. What already exists — do not rebuild

| Capability | Where |
|---|---|
| Word generation from checklist data (`docxtemplater` + `pizzip`) | `src/lib/incorporation-docs/docx.ts`, templates in `public/templates/*.docx` |
| 10 doc kinds: DIR-2, DIR-8, INC-9, PAN undertaking, MOA, AOA, authorisation letter, acceptance letter, MOA and AOA subscription sheets | `src/lib/incorporation-docs/types.ts` (`INCORP_DOC_DEFINITIONS`) |
| Generate + store + patch pre-7 responses | `src/lib/api/incorporation-docs-generate.ts`, route `app/api/engagements/[id]/incorporation-docs/generate` |
| Lead generate panel with inline preview and edit | `src/components/incorporation/IncorporationDocsGeneratePanel.tsx` |
| Bulk share of drafts to the client, client download at pre-8 | `src/lib/incorporation-docs/share.ts`, route `.../incorporation-docs/share` |
| Signed uploads at pre-8 | `CLIENT_RESPONSE_FIELDS['pre-8']`, `src/lib/checklist-pre8-validation.ts` |
| Template tagging helper (yellow-highlighted runs become `{TAG}`) | `scripts/incorp-docx-prepare-utils.mjs` |
| N director KYC slots (NR and resident, up to 4) | `getPre6DirectorSlotsFromPre1`, `pre6NrFieldPrefix` in `src/lib/checklist-pre6-validation.ts` |
| DIN per director | pre-1 `director{n}Din` — **captured but never read by a generator** |
| Other company interests per director (up to 5 × name, shareholding, designation, start, end) | pre-6 `{prefix}OtherCompanyInterest{i}*` — **captured but never read by a generator** |

---

## 2. The gaps — this is the whole job

| # | Gap | Evidence |
|---|---|---|
| G1 | **Generation is fixed to one NR + one resident director.** `IncorpDocAudience = 'non-resident' \| 'resident' \| 'company'`. A second resident director gets no DIR-2, DIR-8 or INC-9. The firm's real case is two resident directors. | `shared.ts`, `types.ts` `draftUrlField`, `share.ts` `INCORP_DRAFT_TO_SIGNED_FIELD`, `isIncorpDraftRowKey` |
| G2 | **Pre-8 signed uploads are fixed to the same two slots.** | `checklist-pre8-validation.ts`, `CLIENT_RESPONSE_FIELDS['pre-8']` |
| G3 | **Captured data is ignored.** DIR-2 hardcodes `DIRECTOR_DIN: '-'` and `DIRECTOR_OTHER_DIRECTORSHIPS: 'NIL'`. DIR-8 hardcodes `PRIOR_DIR_*: 'NA'`. | `dir2.ts`, `dir8.ts` |
| G4 | **Signing date and place are not controllable.** Date is always `new Date()`; place is the literal `'India'` or `'Foreign'`. | `shared.ts` `documentPlaceForDirector`, every `build*MergeFields` |
| G5 | **Two documents in the firm's pack have no template:** ID and address declaration (Rule 16(1)(m)) and deposit declaration. | not in `INCORP_DOC_KINDS` |
| G6 | **No one-click download.** Every draft is a separate download for lead and client. | no zip route exists |
| G7 | MBP-1 and the EPFO specimen signature card exist in the firm's workbook (MBP-1 sheets are hidden and their cell references are off by one row). Neither belongs to pre-incorporation. | deferred, see Phase 6 |

Not gaps: the workbook's master sheet has 25 inputs that no form reads (capital, shares, bank, company email and phone, Aadhaar, city, state, PIN, shares subscribed). Do not add fields for them.

---

## 3. Alignment with the Part B restructure — read before writing code

**Updated 2026-09-22.** The restructure in `docs/spice-part-b-restructure-context.md` is **done** (deployed `6954696`, 2026-09-16), not paused. Directors now live in the `pre-15` Proposed Directors step as a repeating list (`directors` group, entry fields `firstName … otherCompanyInterestDetails`, see `CLIENT_RESPONSE_FIELDS['pre-15']`). `pre-6` Director KYC is still in the catalog for old engagements but in no phase; it is never rendered for new ones.

### What already exists

`src/lib/proposed-directors.ts` is the single director accessor and every generator path already reads through it:

```ts
export interface ProposedDirector {
  id: string;            // pre-15 entry id (`e<8 hex>`), or `legacy-{n}` when rebuilt from pre-1 + pre-6
  index: number;         // 1-based position in the list
  values: Record<string, string>;  // pre-15 template ids: firstName, gender, indiaResident, din, dob, fatherName, panNumber, …
}
export function readProposedDirectors(state): ProposedDirector[];      // pre-15 entries, else legacy slots
export function directorResponsesFromState(state): { pre1, pre6 };     // what the generators consume today
```

`directorResponsesFromState` **synthesises** the legacy `pre1` (`director{n}*`) and `pre6` (`nrDirector*` / `residentDirector*`) maps from the entries. The generators still take `IncorpMergeInput { pre1, pre5, pre6, director }` with `director: 'non-resident' | 'resident' | 'company'`, so only the **first non-resident and first resident** entry can be rendered. That is gap G1 and it is unchanged.

### What this document's Phase 1 now means

- Do not create a second accessor. Extend `ProposedDirector` consumers instead: derive `DirectorEntry` (key, fieldPrefix, kind, display fields, `otherInterests`) **from** `readProposedDirectors`, in the same file or a sibling that imports it.
- The key and prefix rules below still hold, because the synthesised `pre6` map already uses `pre6NrFieldPrefix(n)` / `pre6ResidentFieldPrefix(n)` slot numbering (`directorsAsPre6Responses`). First-slot keys equal today's audience strings, so stored row keys, draft paths and signed-upload fields keep resolving.
- Per-director response keys on `pre-7` / `pre-8` remain `${fieldPrefix}${DocSuffix}DraftUrl` / `SignedUrl`; nothing outside the accessor may construct a prefix.
- The "repoint generators" step of the restructure is already done; what is left is widening `IncorpDocAudience` past the two legacy audiences so entries 3+ get documents.

| Director | `key` | `fieldPrefix` |
|---|---|---|
| first non-resident entry | `non-resident` | `nrDirector` |
| first resident entry | `resident` | `residentDirector` |
| nth non-resident entry (n ≥ 2) | `non-resident-{n}` | `nrDirector{n}` |
| nth resident entry (n ≥ 2) | `resident-{n}` | `residentDirector{n}` |

Other interests: `pre-15` captures them as one free-text field (`otherCompanyInterestDetails`), not the five structured `OtherCompanyInterest{i}*` fields that `pre-6` had. Phase 3's DIR-8 table needs a structured source; either add structured entry fields to `pre-15` (additive, `showWhen: hasOtherCompanyInterest = yes`) or parse the text. Decide at that phase's start.

### Interaction with the document pack

`docs/DOC-PACK-CONTEXT.md` builds a read-only readiness view over the same generators (`src/lib/doc-pack/`). Its registry lists only what the generators render today; when this document widens generation to entries 3+, add the new audiences to `audiencesForDoc` and the pack expands automatically. Do not fork the registry.

---

## 4. Phases

### Phase 0 — confirm and PAUSE

No code. Report, in under 60 lines:

1. Anything in §1–§3 that no longer matches the repo at HEAD.
2. Confirm the accessor shape in `src/lib/proposed-directors.ts` still matches §3 (`readProposedDirectors`, `directorResponsesFromState`).
3. How `checklist-pre7-validation.ts`, `isBulkIncorpShareComplete` and `allIncorpDraftSlotsGenerated` treat "all slots generated". New doc kinds and new director slots must not flip an already-terminal pre-7 back to incomplete. Propose the rule.
4. How the existing single-file download route authorises staff vs client and whether it writes an audit event. Phase 5 copies that exactly.
5. Whether `docxtemplater` table-row loops render correctly through `renderDocx` today, given `fieldsToDocxData` coerces everything to strings and `nullGetter` is key-based.

Then stop for answers to §6 Q1–Q4.

### Phase 1 — director accessor and per-entry audiences (G1)

- Add `src/lib/proposed-directors.ts` per §3, with tests covering: 1 NR + 1 resident (legacy keys), 2 residents + 0 NR, 1 NR + 3 residents, missing pre-6, `fieldIdMatchesPre6Prefix` edge (`nrDirector` must not match `nrDirector2*`).
- `IncorpDocAudience` becomes `'company' | string` (a `DirectorEntry.key`). `IncorpMergeInput` gains `entry?: DirectorEntry`; `directorField(pre6, director, suffix)` stays as a thin legacy wrapper over the entry so untouched callers compile.
- Replace the static `draftUrlField` maps in `types.ts` with `draftFieldIdFor(doc, entry | 'company')` built from `fieldPrefix` + a per-doc `docSuffix`. Keep `draftUrlFieldFor(doc, audience)` working for the two legacy audiences.
- `audiencesForDoc(doc)` becomes `audiencesForDoc(doc, entries)`: director docs → every entry (PAN undertaking → non-resident entries only); company docs → `['company']`.
- Update `paths.ts` (labels and filenames use `entry.displayName`; filename pattern unchanged for slot 1), `share.ts` (`isIncorpDraftRowKey` accepts `resident-2` style keys; `signedUploadFieldForIncorpDraft` derives from `fieldPrefix`), `storage.ts`, `incorporation-docs-generate.ts`, `incorporation-docs-errors.ts` (`collectIncorpDocsMissingFields` per entry), and `IncorporationDocsGeneratePanel.tsx` (rows grouped under a director heading — same row component, no new layout language).
- **Preserve:** existing row keys, response keys, S3 paths, the `generateAndStoreDir2` compat export, the inline preview-and-patch flow, share semantics.
- Commit: `feat(incorp-docs): per-director generation through the proposed-directors accessor`

### Phase 2 — per-director signed uploads at pre-8 (G2)

- Build the pre-8 per-director file fields dynamically from `resolveDirectorEntries`, the same way pre-6 builds its slot fields. Slot-1 ids stay literal-identical.
- `PRE8_REQUIRED_FILE_IDS` becomes a function of the entries. A director added after pre-8 was already accepted must not re-lock later steps silently — surface it as a reopened field, which the gate already understands.
- Do not touch the COI entry or any label here; the restructure owns those.
- Roles: Client (more upload rows when there are more directors), Project Lead and Manager (review lists grow). No email change.
- Commit: `feat(pre-8): signed upload slots follow the director list`

### Phase 3 — use the data already captured (G3, G4)

- DIR-2: `DIRECTOR_DIN` ← `entry.din` else `'-'`. `DIRECTOR_OTHER_DIRECTORSHIPS` ← count per §6 Q2 else `'NIL'`.
- DIR-8: replace the four scalar `PRIOR_DIR_*` tags with a table-row loop over `entry.otherInterests`; an empty list renders one `NA` row. Extend `renderDocx` to accept array data for declared loop keys only — do not loosen `nullGetter` globally. Re-tag `public/templates/dir-8.docx` with the prepare helper and add a render test that opens the output XML and counts rows.
- Add optional pre-6 field `{prefix}OtherCompanyInterest{i}Cin` (format-validated CIN or LLPIN, not a registry lookup) next to the existing five. Same `showWhen` as its siblings.
- "son of" is hardcoded in several templates. Derive `S/o` / `D/o` from `entry.gender`; unknown gender keeps `S/o` so existing output is unchanged.
- DIR-2 `DIRECTOR_MEMBERSHIP` ← new optional pre-15 entry field `csMembershipOrCopNumber` (text, no format check); empty renders `'NIL'`. See §9 item 1.
- Signing details: two lead-only pre-7 fields, `incorpDocsSigningDate` (date, default today at generation time) and `incorpDocsSigningPlace` (text). All builders take date and place from one helper in `shared.ts`. When both are empty the output is exactly today's (`new Date()`, `'India'` / `'Foreign'`). Non-resident place behaviour per §6 Q3.
- Commit: `feat(incorp-docs): DIN, directorships, DIR-8 table and signing details from captured data`

### Phase 4 — two new templates (G5)

New doc kinds `id-address-declaration` (suffix `IdAddressDeclaration`) and `deposit-declaration` (suffix `DepositDeclaration`). Each: a `.docx` in `public/templates/` tagged with the prepare helper, a `build*MergeFields` module beside `inc9.ts`, a case in `renderIncorpDocxBuffer`, a definition in `INCORP_DOC_DEFINITIONS`, tests. Layout follows `inc-9.docx` (heading, body, signature block: signature line, name, DIN, place, date).

**ID and address declaration** — heading "ID & Address Declaration", sub-heading "Rule 16(1)(m) — Companies (Incorporation) Rules, 2014". Body:

> I, {DIRECTOR_FULL_NAME}, {RELATION_PREFIX} {FATHERS_NAME}, residing at {DIRECTOR_ADDRESS}, proposed to be appointed as First Director of {PROPOSED_COMPANY_NAME} ("Proposed Company") hereby declare, pursuant to explanation provided under rule 16(1)(m) of the Companies (Incorporation) Rules, 2014, that the identity details and residence address (Present and Permanent) as mentioned in SPICe+ Form are the same as mentioned in the DIN details as on the date of application.

The wording only makes sense for a director who already holds a DIN. Generate it only when `entry.din` is non-empty (`appliesTo(entry)` on the definition), pending §6 Q1.

**Deposit declaration** — heading "Deposit Declaration". Body:

> I, {DIRECTOR_FULL_NAME}, {RELATION_PREFIX} {FATHERS_NAME}, residing at {DIRECTOR_ADDRESS}, being a First Director as mentioned in the Articles of Association of {PROPOSED_COMPANY_NAME} ("Proposed Company") under the process of Incorporation, declare that:
> 1. All the requirements of the Companies Act, 2013 and the rules made thereunder relating to incorporation of the company under the Act and matters precedent or incidental thereto have been complied with.
> 2. The Company will not accept deposits unless in compliance with the applicable provisions of the Companies Act, 2013, RBI Act, 1934, and SEBI Act, 1992, and rules/directions/regulations made thereunder and the necessary documents/information(s) are filed with the Concerned Authorities.
>
> Yours faithfully,

Signature block adds the line: (FIRST DIRECTOR NAMED IN THE ARTICLES OF ASSOCIATION OF {PROPOSED_COMPANY_NAME} — PROPOSED).

- Both are **additive for completeness**: apply the rule agreed in Phase 0 item 3 so engagements whose pre-7 is already shared or terminal are not reopened.
- Pre-8 gets matching optional signed-upload rows through the Phase 2 builder.
- Commit: `feat(incorp-docs): ID and address declaration and deposit declaration`

### Phase 5 — generate all and one-click download (G6)

- Lead panel: one **Generate all** action calling the existing generate route with every applicable `{doc, audience}`; per-row generate stays. Failures report per row, not all-or-nothing.
- New route `GET app/api/engagements/[id]/incorporation-docs/download-all`. Server builds the zip in memory with `pizzip` (already a dependency; files are small). Auth and audit copy the single-file route exactly (Phase 0 item 4).
  - Staff: every generated draft.
  - **Client: only rows in `sharedIncorpDraftDocs`** — reuse `filterClientVisibleIncorpDrafts`. Never widen what the client can see.
- Zip layout: `{company-slug}-incorporation-drafts/Company/…` and `…/{Director display name}/…`, filenames from `incorpDocDownloadFilename`.
- UI: one **Download all (.zip)** button on the lead panel and on the client pre-8 download list. Existing primitives only; status colour stays on chips.
- Board-resolution drafts are **not** in this zip under any role.
- Commit: `feat(incorp-docs): generate all and zip download for lead and client`

### Phase 6 — deferred pack, only after §6 Q4 is answered

MBP-1 (belongs to First board meeting, `post-1`) and the EPFO specimen signature card (belongs with PF, after COI). Same generator pattern, reading the same accessor and `entry.otherInterests`. Needs a generate surface on a post-incorporation step, which does not exist today — propose the smallest one and stop for a yes before building.

### Phase 7 — documentation

Update `CLAUDE-CONTEXT.md` §4 (pre-7 doc list), `docs/context/STATE.md`, `docs/context/NOTES.md` (the key and prefix rules from §3), and add one line to `docs/spice-part-b-restructure-context.md` §7: "generators already read directors through `src/lib/proposed-directors.ts`; Phase 2 swaps its source."
- Commit: `docs: incorporation doc pack`

---

## 5. Roles affected

| Role | Change |
|---|---|
| Project Lead | Generate panel grouped per director, Generate all, Download all, two signing fields, one optional CIN field in director KYC |
| Project Manager / Firm Admin | Longer review lists when there are more directors. Shared views — one change covers both prefixes |
| Client | More drafts and upload rows when there are more directors; one Download all button. Gate, inbox and visibility rules unchanged |
| Super Admin | None |

---

## 6. Open questions

Blocking (ask at the Phase 0 pause; these are for the firm's CA, not guessable from code):

1. **ID and address declaration:** only for directors who already hold a DIN, or for every director?
2. **DIR-2 "number of directorships":** count of other-interest entries whose designation is a directorship, or all entries? Default if unanswered: all entries.
3. **Signing place for a non-resident director:** keep `'Foreign'`, use the pre-7 place, or add a per-director place? Default: unchanged.
4. **MBP-1 and EPFO specimen card:** wanted at all, and at which step?

Non-blocking:

5. Are the two new declarations filed as SPICe+ attachments, or kept on the firm's file only? Decides whether their pre-8 upload rows are required or optional. Default: optional.
6. PDF output is out of scope — it needs a LibreOffice sidecar, which is new infrastructure.

---

## 7. Risks

- **Row-key drift.** One place constructing `nrDirector2…` by hand breaks the restructure swap later. Grep for `nrDirector` and `residentDirector` string literals outside the accessor, pre-6 field templates and legacy tests at the end of Phase 1 and report the count.
- **Reopening finished work.** New slots and new doc kinds can flip "all generated" or "all uploaded" to false on live engagements. Covered by Phase 0 item 3 and Phase 2 — test with a fixture whose pre-7 and pre-8 are already terminal.
- **Director list changes after generation.** Removing director 1 renumbers slots today. Do not solve that here; the restructure's stable entry ids do. State it in NOTES.md.
- **Client visibility.** The zip route is the one place this work could leak an unshared draft. Test it with a client `AuthContext` against a mix of shared and unshared rows.
- **Template fidelity.** `docxtemplater` loop tags split across Word runs fail silently as literal text. Assert on output XML, not on "render did not throw".

---

## 8. Kick-off prompt

```
Read CLAUDE-CONTEXT.md, docs/spice-part-b-restructure-context.md,
docs/spice-part-b-restructure-DISCOVERY.md, then docs/incorp-doc-pack-context.md.

Execute docs/incorp-doc-pack-context.md. Start with Phase 0: no code, report the
five items in under 60 lines, list Q1–Q4 from §6, and stop.

After I answer, run Phases 1 to 5 in order without asking permission between them.
After each phase run the verification gate from §0 and report the real numbers
(TS error count, vitest pass/fail counts, lint result), then commit with the
message given. If a gate fails, fix it before moving on; if an existing test has
to change, say which and why before changing it.

Hard stops: any need for a new table, any change to email, gate, share or
board-resolution semantics, any real personal data in a fixture, or evidence that
the Part B restructure has already landed. Stop and report instead of working
around it. Do not start Phase 6 without an explicit yes.
```

---

## 9. Workbook cross-check (Incorporation_Excel (2), 2026-09-22)

Sheet → doc kind map (Phase 0 must confirm nothing else is in the workbook):
MASTER DATA → inputs · DIR-2 ×2 → `dir-2` · DIR-8 ×2 → `dir-8` · INC-9 ×2 → `inc-9`
· ID & Addr Decl ×2 → `id-address-declaration` (Phase 4) · Deposit Decl ×2 →
`deposit-declaration` (Phase 4) · MBP-1 ×2 → Phase 6 · Specimen Signatures → Phase 6.
The workbook has no MOA/AOA, subscription sheets, PAN undertaking or letters — the
app is ahead there; do not remove anything.

Corrections to earlier assumptions:
1. DIR-2 in the workbook carries **CS Membership No. / COP No.** (real value on one
   director, NIL on the other). `dir2.ts` hardcodes `DIRECTOR_MEMBERSHIP: 'NIL'`.
   Phase 3 adds one optional `pre-15` entry field `csMembershipOrCopNumber` (text,
   no format check) and reads it; empty → `'NIL'`. Add this to §6 as Q7 only if the
   CA says it is never used — default is to add the field.
2. DIR-2 "No. of Directorships" in the workbook is a **count** (0 / 1), which is
   what §6 Q2 already covers. Keep the default (count all other-interest entries).
3. The workbook's ID & Addr Decl and Deposit Decl are **per director, all
   directors** (both have a DIN). That does not settle §6 Q1 — still ask.
4. Do not copy template text from the workbook cells. Beyond the MBP-1 row offset
   already noted in G7, Deposit Decl Dir2 has a blank address and ID & Addr Decl
   Dir2 renders Dir1's address. Phase 4 body text in this file is the source; the
   workbook is only evidence of which documents exist.
5. Workbook signing block = Date of Signing + Place of Signing (Hyderabad), shared
   by every sheet. This matches Phase 3's two lead-only `pre-7` fields; no
   per-director place is needed for the domestic case (§6 Q3 default holds).
6. Master sheet inputs the app does not read, confirmed as not gaps (already in §2):
   Aadhaar, company email/phone, bank name, no. of equity shares, shares subscribed,
   city/state/PIN split. Do not add fields for them.

---

## 10. Phase 0 findings and owner answers (2026-09-23)

Findings at HEAD `f4d7eb8`:

- `src/lib/proposed-directors.ts` already exists with the §3 shape; Phase 1 extends it, it does not add it.
- `validatePre7Responses` and `validatePre8Responses` hard-require both the `nrDirector*` and the `residentDirector*` slots, so a company with two resident directors and no non-resident cannot pass pre-7 or pre-8 today. Phases 1 and 2 make the required set follow the director list.
- "All generated" (`allIncorpDraftSlotsGenerated`) is every slot from `incorpDraftDocSlotsFromResponses` — the static kinds × the two legacy audiences. The share route refuses to share until it is true.
- The single-file download route authorises `admin | manager | intern | client` through `assertEngagementBoardResolutionAccess`, limits a client to `sharedIncorpDraftDocs`, and writes **no** audit event. The zip route copies that exactly.
- `renderDocx` cannot loop today: `fieldsToDocxData` stringifies every value and `nullGetter` echoes unknown tags as literal text. Phase 3 adds array data for declared loop keys only.

Rule for "all generated" and the validators (Phase 0 item 3): the required slot set is derived from the director entries. Slots that did not exist in the legacy set (entries 3+, the two new declarations) are required only while pre-7 has not been shared (`incorpDraftsSharedAt` unset) and is not accepted; after that they are optional extras, so no live engagement reopens.

Owner answers:

1. **Q1:** ID and address declaration only for directors who hold a DIN.
2. **Q2:** DIR-2 "No. of directorships" counts all other-interest entries.
3. **Q3:** unchanged — non-resident place stays `'Foreign'` unless the pre-7 signing place is filled.
4. **Q4:** Phase 6 skipped for now.
5. **DIR-8 source:** additive structured fields on the `pre-15` director entry for up to three other interests (`otherInterest{i}Company`, `Cin`, `Designation`, `From`, `To`, shown when `hasOtherCompanyInterest = yes`). The free-text `otherCompanyInterestDetails` stays. Legacy engagements read the `pre-6` `OtherCompanyInterest{i}*` fields.
