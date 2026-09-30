# Incorporation document gaps — Phase 0 discovery

Date: 2026-09-24. Scope: `DOC-GAPS-CONTEXT.md` §4 items 1–7, read only. No code was changed and no tests were run. Line numbers are from the working tree at `b6ed2bf`.

Workbook facts come from the firm's master Excel (`Incorporation_Excel.xlsx`), extracted separately. They are quoted where they matter.

---

## 1. Subscription sheet: variant, subscriber, templates

**Where `variant` is decided or defaulted**

| Place | What happens |
|---|---|
| `src/lib/incorporation-docs/subscription-sheet.ts:21` | `type SubscriptionSheetVariant = 'foreign' \| 'resident'` |
| `subscription-sheet.ts:73-78` | `subscriptionSheetVariantForDoc(doc)` ignores `doc` and always returns `'foreign'`. It takes no engagement or state, so it has nothing to decide from. |
| `subscription-sheet.ts:86` | `buildSubscriptionSheetMergeFields` defaults `variant = 'foreign'` |
| `subscription-sheet.ts:139` | `collectSubscriptionSheetMissingFields(input, variant = 'foreign')` |
| `src/lib/incorporation-docs/docx.ts:219` | the only caller: `renderSubscriptionSheetDocxBuffer` → `subscriptionSheetVariantForDoc(doc)` |
| `src/lib/api/incorporation-docs-errors.ts:139` | the missing-field check is called without a variant, so it is always `'foreign'` |
| `src/lib/incorporation-docs/types.ts:152-169` | both sheets use one template, `moa-aoa-subscription-sheet-foreign.docx`. `templateRelative` is a fixed string. |
| `src/lib/doc-pack/registry.ts:178-207` | pack `requiredInputs` for both sheets always call `nonResidentLetterInputs(...)` (`:32-40`). A company with only resident directors therefore shows `needs-inputs: A non-resident director`. |

**How the subscriber is picked** (`subscription-sheet.ts:88-131`)
- `'foreign'` uses the first non-resident director (`nrDirector*` in the synthesised `pre6`). `'resident'` uses the first resident director. The code never reads `pre-16`.
- The parent entity name and address come from `pre-1` or the engagement (`:109-110`).
- `EQUITY_SHARES_SUBSCRIBED` (`:64-71`) = **all** paid-up shares (paid-up ÷ nominal, `moa.ts:74-85`), followed by the words of the paid-up **rupee amount**. Example: `10,000 (Indian Rupees One Lakh Only)`. The words describe the amount, not the share count. This is a bug.
- `WITNESS_NAME_AND_ADDRESS` is built (`:99-106`, `:128-131`) but is **not** in `SUBSCRIPTION_SHEET_MERGE_FIELD_KEYS` (`:37-48`, 10 keys). No template has the tag either, so it is dead output. In the resident branch it would name the non-resident director as witness.

**Templates.** I extracted `word/document.xml` and joined `w:t` per paragraph. All three files have the same layout: two tables. Page 1 is the MOA sheet, with a "No. of shares taken" column. Page 2 is the AOA sheet, with no shares column. Headers and footers hold only "PAGE 1". There are no text boxes.

| File | Merge tags | Hardcoded sample data |
|---|---|---|
| `public/templates/MOA & AOA Subcription Sheets Resident.docx` (unreferenced) | **none** | Subscriber "Naga Durgesh Ravanam" "(Nominee Shareholder of Aloha Practice Management, Inc)", S/o "Vana Maheswara Rao Ravanam", address "C/o Vana Maheswara Rao Ravanam, 8-4-20/1, Machi raju street, Amalapuram, East Godavari, Andhra Pradesh, 533201, India", DOB 23-05-1986, Occupation Employment, Nationality India, shares "1 (One)", total "1 (One)". Witness "MITHILESH SAI SANNAREDDY, Suite 5, Level 3, Reliance Cyber Ville, Vittal Rao Nagar, Madhapur, Hyderabad, 500081 … Practicing Chartered Accountant" appears on both pages. The page 2 address wraps differently ("C/O … Amalapuram, / Amalapuram, East Godavari, Andhra / Pradesh, 533201"). All of it must be stripped. |
| `public/templates/MOA & AOA Subscription Sheets Foreign.docx` (the original of the prepared file, unreferenced) | none | "Aloha Practice Management, Inc", "108 Lakeland Avenue, Dover DE 19901 … USA", resolution dated 02.02.2025, "Justin Cheng Hsu", S/o "Xiao Ming Hsu", "2544 Horsetail Road Frisco, Texas 75033, USA", DOB 25-02-1980, "United Staes" (typo), shares/total "9,999 (Nine Thousand Nine Hundred Ninety-Nine)" |
| `public/templates/moa-aoa-subscription-sheet-foreign.docx` (registered) | `PARENT_ENTITY_NAME, PARENT_ENTITY_ADDRESS, SUBSCRIPTION_DATE, SUBSCRIBER_FULL_NAME, SUBSCRIBER_FATHER_NAME, SUBSCRIBER_ADDRESS, SUBSCRIBER_DOB, SUBSCRIBER_OCCUPATION, SUBSCRIBER_NATIONALITY, EQUITY_SHARES_SUBSCRIBED`. All tags are intact in the XML (not split across runs). | No sample data left. The witness name and address are blank. |

**Bugs in the registered foreign template:**
1. **Page 2 (AOA) tags are shifted by one label.** For example, "Body corporate/ company name: {PARENT_ENTITY_ADDRESS}", "Address: {SUBSCRIPTION_DATE} … dated: {SUBSCRIBER_FULL_NAME}", "Name: {SUBSCRIBER_FATHER_NAME}" and so on, down to "Nationality: {EQUITY_SHARES_SUBSCRIBED}". Every generated MOA or AOA subscription sheet today prints wrong values on page 2.
2. On page 1, "TOTAL NO. OF SHARES TAKEN" is followed by `{PARENT_ENTITY_NAME}`, not a share count.
3. Both `moa-subscription-sheet` and `aoa-subscription-sheet` render the **same two-page file** (`types.ts:155,164`). Each download therefore contains both the MOA page and the AOA page.

**How the resident template differs from the foreign one.** The difference is the subscriber's layout, not the company's residency:
- The foreign template is the **body-corporate** layout: company name, address, "represented by its authorized representative vide resolution dated", then the representative's personal block.
- The resident template is the **individual** layout: Name, an optional "(Nominee Shareholder of …)" line, S/o, Address, DOB, Occupation, Nationality. It has no parent-entity lines.
- The firm's two samples are one engagement: the parent took 9,999 shares on the foreign sheet and a resident nominee took 1 share on the resident sheet. That is 10,000 in total, which matches the default paid-up capital (100000 ÷ 10). So the firm already works **one sheet per subscriber**, and the page "total" is that subscriber's own count.

**Key set for the resident copy.**
- It can reuse the 7 individual keys: `SUBSCRIBER_FULL_NAME, SUBSCRIBER_FATHER_NAME, SUBSCRIBER_ADDRESS, SUBSCRIBER_DOB, SUBSCRIBER_OCCUPATION, SUBSCRIBER_NATIONALITY, EQUITY_SHARES_SUBSCRIBED`.
- It must drop `PARENT_ENTITY_*` and `SUBSCRIPTION_DATE`.
- It needs one conditional for the nominee line, for example `{#NOMINEE_OF}(Nominee Shareholder of {NOMINEE_OF}){/NOMINEE_OF}` or a plain `NOMINEE_LINE` string.
- It needs a separate total tag (`TOTAL_SHARES_TAKEN`) if the total is ever meant to differ from the subscriber's count.
- The witness block is the firm's CA. It is hardcoded in the sample and blank in the foreign copy (see §11 Q6).

**Implication for Phase 1:**
- "Matching the foreign key set" means matching a *subset* plus a nominee line.
- The variant is really **individual vs body corporate**. Choose it per subscriber, not per engagement.
- The page 2 tag shift in the existing foreign template is a live bug. Phase 1 is the natural place to fix it, but that breaks the "foreign output byte-for-byte" goal in §5. The owner has to choose between the fix and byte-identical output (§11 Q7).

---

## 2. `pre-16` subscribers and per-director shares

Catalog entry: `src/data/checklist.ts:302-316`. Fields: `src/lib/checklist-responses.ts:1008-1101`.

| Field id | Line | Type / shown when | Notes |
|---|---|---|---|
| `subscribers` (repeat group) | 1010 | `minEntries: 0`, `maxEntries: 50`, section `Subscribers` | an empty group is a valid submit (`emptyLabel` :1017-1018) |
| `type` | 1022 | `individual` \| `non-individual`, required | |
| `entityType` | 1032 | `body-corporate` \| `llp`, when type = non-individual | |
| `name` | 1043 | required. Label switches by entity type. | |
| `cin` | 1053 | body corporate only | |
| `address` | 1062 | **body corporate only** ("Registered address of the body corporate") | |
| `llpin` | 1069 | LLP only | |
| `authorisedPerson` | 1078 | non-individual only, text | name only, no KYC |
| `shares` | 1084 | text, required. Validated as a positive integer (`checklist-part-b-validation.ts:151-153`). | **this is the per-subscriber share count** |
| `shareValue` | 1085 | text, required, INR | |
| `shareholderAuthorizedPerson` | 1089 | step-level text, section `INC-35 nominee` | outside the repeat group |
| `shareholderNominee` | 1096 | step-level text, section `INC-35 nominee` | name only |

- **Reading:** `repeatEntries(responses, group)` (`src/lib/checklist-repeat.ts:125-133`) splits the comma-separated entry ids stored under `subscribers`. It maps each entry to `{ id, index, values }`, where each value comes from the key `subscribers.<entryId>.<fieldId>` (`repeatFieldId` `:40`). No generator or doc-pack code calls it for `pre-16`. The only readers are the validator (`checklist-part-b-validation.ts:139-160`), the form (`useMilestoneResponseFormState.tsx:678,868-872`) and the Assist profile, which does not emit subscribers (`src/lib/assist-profile/build.ts:468-485`).
- **Gap: an individual subscriber has no KYC.** For `type = individual` the step captures only `name`, `shares` and `shareValue`. It has no father's name, address, DOB, occupation, nationality or residency flag, and the subscription sheet needs all of them. An individual `pre-16` subscriber who is *not* also a director cannot be rendered without new optional fields, or without a "same as director N" link.
- **Gap: nominee shareholder.** `shareholderNominee` is a bare name. The resident sample sheet *is* the nominee's sheet, but no nominee KYC exists anywhere.
- **`pre-15` has no per-director share field.** The entry fields at `checklist-responses.ts:891-1005` include no shares or designation field. The only `Designation` is on other interests (`otherInterest{i}Designation`) and on `pre-1.signatoryDesignation` (:117).
- **Two sources for the share count.** Generators use `pre-1` `paidUpShareCapital ÷ nominalValuePerEquityShare` (`moa.ts:74-85`, with defaults 1000000 / 100000 / 10 at `checklist-pre1-validation.ts:46-48`, the same as the workbook). `pre-13` Capital structure also captures `equityQuantity` / `equityNominalValue` (`checklist-responses.ts:784,794`), but no generator reads it.
- **Workbook:** the MASTER DATA has "No. of Shares Subscribed" per director (example: 1 each), plus "Designation" (default "Director"), "No. of Directorships (existing)" and "No. of MD/WTD/CEO/CFO/CS roles". Its company block is Authorized 1000000, Paid-up 100000, 10000 equity shares, face value 10, subscription amount 100000, plus a bank name for the deposit.
- **Data inconsistency to raise with the owner:** in the workbook example the directors subscribe 1 + 1 = 2 shares, but the paid-up count is 10,000.

**Implication for Phase 2 and Phase 4:**
- Use `pre-16.subscribers.*.shares` as is.
- Add optional `sharesSubscribed` and `designation` to the `pre-15` entry, plus the `PRE6_SUFFIX` map (`proposed-directors.ts:122-162`).
- Decide whether to add optional KYC for individual `pre-16` subscribers who are not directors, or to require such subscribers to be directors.
- Validate that Σ shares = paid-up shares as a soft warning, not a gate.

---

## 3. `pre-15` other company interests

- Field builder: `pre15OtherInterestFields()` at `src/lib/checklist-responses.ts:34-46`, spread into the entry at :999. Up to `PRE15_MAX_OTHER_INTERESTS = 3` (`src/lib/other-company-interests.ts:11`). All parts appear only when `hasOtherCompanyInterest = yes` (:985).
- Ids per interest `i`:
  - `otherInterest{i}Company`
  - `otherInterest{i}Cin`
  - `otherInterest{i}Designation`
  - `otherInterest{i}From` (date)
  - `otherInterest{i}To` (date)
- These map to legacy `pre-6` parts through `PRE15_INTEREST_PARTS` (`other-company-interests.ts:23-29`): `Name, Cin, Designation, StartDate, EndDate`. `PRE6_SUFFIX` in `proposed-directors.ts:154-161` uses that mapping.
- The read path is `directorOtherInterests(pre6, d)` (`src/lib/incorporation-docs/shared.ts:68-73`) → `otherInterestsFromPre6` (`other-company-interests.ts:41-60`), which returns `{ company, cin, designation, from, to }`. It is consumed by DIR-8 (`dir8.ts:79`) and the DIR-2 count (`dir2.ts:58-59`).
- There is also a free-text `otherCompanyInterestDetails` (:992-996), labelled "name, CIN/LLPIN, designation, shareholding, dates". It is required when `hasOtherCompanyInterest = yes`, but it is **unstructured**.
- **Missing:** *nature of interest* and *shareholding* have no structured field. MBP-1 columns map as follows:

| MBP-1 column | Source |
|---|---|
| Name of company | `Company` exists |
| Nature of interest | nearest is `Designation`, which exists |
| Shareholding | **absent** |
| Date of interest | `From` exists |

**Implication for Phase 4:** add optional `otherInterest{i}NatureOfInterest` and `otherInterest{i}Shareholding`. Add them to `PRE15_INTEREST_PARTS`, to the `OtherCompanyInterest` type, and to the legacy parts. Suggested legacy names are `NatureOfInterest` / `Shareholding`. `PRE6_MAX_OTHER_INTERESTS = 5` covers legacy engagements. For MBP-1 in Phase 3, fall back to `Designation` for nature and to blank for shareholding, so it ships before Phase 4. The workbook's MBP-1 interest table says "fill manually" with 10 blank rows. Blank cells are acceptable to the firm.

---

## 4. `post-1` First Board Meeting and `reg-1` PF Registration

| | `post-1` | `reg-1` |
|---|---|---|
| Catalog | `src/data/checklist.ts:448-458`, slug `first-board-meeting`, phase `post-inc-phase-3` (:610) | `checklist.ts:643-653`, slug `pf-dsc-esign-registration`, phase `registration-phase-4` (:983) |
| `forms` | `[]` | `['PF registration']` (**not** `[]`) |
| `infoRequired` | `['Agenda of the meeting', 'Minutes', 'Resolutions']` | `KYC_CORE` (:630-640: COI, PAN, BR, Authorisation Letter, MOA, AOA, Rental Deed, Bank Details, Directors' KYC) plus "List of employees" and "Active DSC / e-sign credentials" |
| Response fields | `checklist-responses.ts:1288-1291`: `boardMeetingAgenda` and `boardMeetingMinutes` (textareas, no `section`). **No date field.** | `:1496-1520`: `pfRegistrationNumber` and `pfRegistrationDate` (required, section `PF Registration`), `dscEsignCredentialsNotes` (section `DSC / E-Sign`) |

**How the step page renders these:**
- Both steps have client fields, so `hasClientFields` is true and `showLegacyChecklist` is false (`src/components/admin/StepDetailContent.tsx:155-158`). The legacy Forms/Documents tabs, including "No statutory forms for this step." (`StepDetailContentSections.tsx:229-230`), are **not** shown.
- In the intern workspace the body is `{staffReviewPanel}{phase1Panel}{responseForm}{legacyChecklist}` (`StepDetailContentSections.tsx:427-435`).
- `phase1Panel` exists only for `PHASE1_PANEL_IDS` (:29-40, `pre-2…pre-12`). `post-1` and `reg-1` render just the response form.
- The step page's doc-pack surfaces (rail card, header button, `DocSourceStrip`) are gated by `docPackVisible`. That flag is true only for `pre-inc-phase-1` / `pre-inc-phase-2` (`src/views/engagement/EngagementStepDetail.tsx:198-201`), so none of them appear on `post-1` or `reg-1` today.

**Comparable mounts:**
- Pre-2 BR card: `BoardResolutionStepLink`, built as `internBoardResolutionAction` (`StepDetailContentSections.tsx:152-157`). It is intern-only and never shown to a client or to staff review, and it is passed as `aboveFooterActions` of the response form (:176).
- Pre-7 generate panel: `IncorporationDocsGeneratePanel`, mounted inside `Phase1Pre7Panel` for non-client viewers (`Phase1StepPanelRoutePanels.tsx:346-352`), below the response form (`StepDetailContentSections.tsx:432`). Shared chrome: `PanelShell` (`Phase1StepPanelParts.tsx:17`).

**Where a "generated documents" card should sit:**
- Preferred: in `EngagementStepDetail.tsx`, next to `docPackRailCard`. Put it in the right-hand rail under `ChecklistJourneyRail` (`:472-508`, `{docPackRailCard}` at :507), gated by `!isClientRoute && (item.id === 'post-1' || item.id === 'reg-1')`. Keep the `lg:hidden` header-button fallback in `stepTitleRow` (:382-392). This uses the same component and the same gate style, and it keeps `StepDetailContentSections` (lifted-ish UI) untouched.
- Alternative: an inline card above the form. Mirror `internBoardResolutionAction` through a new `aboveFooterActions` branch.

**Implication for Phase 3 and Phase 5:** add one `docPackRailCard`-like mount keyed by step id. There is no Phase1 panel plumbing to extend for post-inc or registration steps.

---

## 5. Doc pack: how `part` is consumed

`DocPart = 'part-a' | 'part-b'` (`src/lib/doc-pack/types.ts:19`), used on `DocDefinition.part` (:81) and `DocPackItem.part` (:110).

| Consumer | Uses `part`? | Effect of adding `'post-inc'` / `'registration'` |
|---|---|---|
| `evaluate.ts:149` | copies `def.part` to the item | fine |
| `evaluate.ts:223-226` `counts` / `total` | **no, counts all items** | post-inc and registration items would inflate every pre-inc count |
| Rail card `DocPackRailCard.tsx:48-49,78-87` | uses `summary.total` / `counts` | wrong "N of M ready" |
| Header button `DocPackHeaderButton.tsx:20-21` | same | wrong |
| Overview pill `DocPackPhasePill.tsx:20-32` (callers `EngagementDetail.tsx:244-248`, `ProjectDetail.tsx:66-73` map the phase to a part only for the href) | whole summary, not per part | wrong. It already shows the *combined* A+B count on both rows. |
| Step strip `step-strip.ts:11` | filters by `sourceStepIds` | MBP-1 (`pre-5`, `pre-15`) and EPFO (`pre-5`, `pre-14`, `pre-15`) would be counted on those pre-inc steps |
| Fastest unblock `unblock.ts:18` | all items | could point a pre-inc step at `post-1` or `reg-1` inputs |
| Pack page `DocPackView.tsx:32-37,91-93,168` | `PART_LABEL: Record<PartFilter,string>` (typecheck forces labels), filter buttons hardcoded `['all','part-a','part-b']` | new items appear under "All" only |
| `paths.ts:55-56` `parseDocPart` | whitelists two values | `?part=post-inc` would parse to `null` |
| Zip `src/lib/api/doc-pack.ts:164-186`, route `doc-pack/zip/route.ts:12-25` | every ready item, named `{slug}-pre-incorporation-{date}.zip` | would bundle MBP-1 and EPFO into the "pre-incorporation" zip |
| Item route `renderDocPackItem` `doc-pack.ts:108-151` | looks up by key in the full summary | fine, and it needs the full summary to find post-inc keys |

**Recommendation (least invasive): keep one registry and add the part values.**
1. Widen `DocPart` to `'part-a' | 'part-b' | 'post-inc' | 'registration'` and export `PRE_INC_PARTS = ['part-a','part-b']`.
2. Keep `evaluateDocPack` returning every item, so item routes keep working. Add a pure helper `scopeDocPackSummary(summary, parts)` that re-derives `items`, `counts` and `total`.
3. Apply it **once** in `useDocPack`, via TanStack `select`. The default scope is `PRE_INC_PARTS`. With that one change, the rail card, header button, pill and step strip stay exactly as they are. The `post-1` / `reg-1` cards call the hook with `['post-inc']` / `['registration']`.
4. Zip: take an optional `?part=`. Default to the pre-inc parts so today's zip is unchanged. Use `…-post-incorporation-…` / `…-registration-…` names for the other scopes.
5. Pack page: widen `parseDocPart` and render a filter button only when `countFor(part) > 0`.

A separate registry would duplicate `evaluateItem`, the release gates and the item and zip routes for no gain.

**Also needed: stop MBP-1 and EPFO leaking into Pre-7.** `INCORP_DOC_KINDS` (`incorporation-docs/types.ts:29-42`) is iterated by:
- Pre-7 "generate all": `generate/route.ts:59`, `incorporation-docs-generate.ts:40,75`
- the missing-field sweep (`incorporation-docs-errors.ts:158`)
- `preview-url.ts:32`
- the share whitelist (`share.ts:29`)
- the download and share routes (`download/route.ts:28`, `share/route.ts:35`)

`Object.keys(INCORP_DOC_DEFINITIONS)` also builds the Pre-7 and Pre-8 slot lists (`paths.ts:132,177`). Not adding the draft field to `PRE7_REQUIRED_FILE_IDS` is **not enough**. As written in §7.3 of the context, a Pre-7 "generate all" would render MBP-1, upload it to S3 and write `*Mbp1DraftUrl` into `pre-7` responses, and MBP-1 would be listed among the Pre-7 and Pre-8 draft slots. Add a `stage: 'pre-7' | 'post-inc' | 'registration'` (default `'pre-7'`) to `IncorpDocDefinition` and filter those iteration sites to `'pre-7'`. Alternatively, keep MBP-1 and EPFO out of `INCORP_DOC_KINDS` and dispatch them from the doc-pack `GeneratorRef` directly, for example `{ kind: 'post-inc'; doc: 'mbp-1' }`.

**Implication for Phase 3 and Phase 5:** widen `DocPart`, add `select` scoping in `use-doc-pack.ts:27-34`, add a scoped zip, and add the stage filter on the incorporation-docs iteration sites.

---

## 6. Template validation test

- `src/lib/incorporation-docs/templates.test.ts:8` covers only `dir-2`, `dir-8`, `inc-9` and `pan-undertaking`. For each file it checks that the file exists, that `word/*.xml` parts exist, and that there are **no duplicate attributes** in any `word/*.xml` part (`countDuplicateAttrs` :19-32). Only INC-9 also asserts intact tags in `document.xml`, parseable with `@xmldom/xmldom` (:49-59).
- The subscription sheets, MOA, AOA, letters and declarations are **not** in `TEMPLATE_FILES`. The declarations are covered by render tests (`declarations.test.ts:36-47`: rendered text has no `{` left and contains the expected strings).
- At render time, every template goes through `renderDocx` (`docx.ts:110-138`): Docxtemplater with `paragraphLoop` and `linebreaks`. The `nullGetter` blanks only declared keys; unknown tags pass through as literal text. Output is then sanitised (`docx-sanitize.ts:57`) and SAX-validated (`docx-validate.ts:23-31`), and a failure throws.
- There is no dedicated `subscription-sheet.test.ts` today.

**What a new template must satisfy:**
- Add it to `TEMPLATE_FILES`: no duplicate attributes in any `word/*.xml`.
- Every tag must be a single intact `{KEY}` in one run, so each declared key is findable by a plain `xml.toContain('{KEY}')`.
- Loops must use `{#KEY}…{/KEY}` in one table row, like DIR-8's `PRIOR_DIRECTORSHIPS` (`dir8.ts:64`).
- A render with the fixture must leave no `{` behind and must pass `assertIncorpDocxWordXmlValid`.
- It must carry no sample names or numbers. Add an explicit assertion for this, such as the absence of "Aloha", "Ravanam" and "SANNAREDDY" for the resident sheet.

**Implication for Phase 1, 3 and 5:** add the three new files and the resident sheet to `TEMPLATE_FILES`. Add an INC-9-style tag assertion per file, and a "no sample data" assertion.

---

## 7. Signing date and place

- `signingDate(input)` (`shared.ts:37-45`) reads `pre-7.incorpDocsSigningDate` (`checklist-responses.ts:395-400`, labelled "blank = the day they are generated"), else **today**.
- `signingPlace(input, director)` (`shared.ts:51-54`) returns "Foreign" for non-residents regardless of input. Residents get `pre-7.incorpDocsSigningPlace` (:402-408), else "India".
- Both are fed by `IncorpMergeInput.pre7` (`shared.ts:27-28`), which the pack passes in (`doc-pack.ts:142-149`).
- **`post-1` captures no meeting date** (only agenda and minutes, :1289-1290). Nothing else in the repo stores a board-meeting date (grep for `boardMeeting` / `meetingDate` finds only those two fields). The only date-like fallback is the step's `completedOn` in checklist state, and it is set only when the step is completed.
- `reg-1` has `pfRegistrationDate` (:1506), but the specimen card is signed *before* registration, so that date does not fit.
- **Company name after incorporation:** `pre-12.incorporatedCompanyName` (:1181) and `cin` (:1199) exist. The context's "`pre-12` COI name if captured" is available.
- **Registered office after a change:** the INC-22 step is **`post-11`**, not `post-10`. Its field is `inc22NewAddress` (`checklist-responses.ts:1410-1418`; catalog `checklist.ts:574-591`). `post-10` is "Name Board".

**Implication:**
- MBP-1 cannot reuse `signingDate()` meaningfully: the pre-7 date is the SPICe+ signing date, and it can be months before the first board meeting.
- Phase 4 should add an optional `post-1.boardMeetingDate`, and MBP-1 should use `boardMeetingDate → blank line for manual fill`. Do not fall back to today.
- The place can come from `pre-7.incorpDocsSigningPlace`, else "India". A non-resident director at a board meeting in India signs in India, so do **not** reuse `signingPlace()`'s "Foreign" rule.
- EPFO has no printed date on the workbook card. Only name, designation and signatures are needed, so no date source is required.

---

## Proposed answers to §11 open questions (recommendations awaiting the owner's decision)

These are **recommendations only**. The owner decides.

1. **MBP-1 placement.** Recommend `post-1` as the home. The pack page's "Post-incorporation" filter also makes it downloadable any time after directors are accepted, so the firm can collect MBP-1 signatures with DIR-2/8/INC-9 if it wants. Do not add it to Pre-7 or `PRE7_REQUIRED_FILE_IDS`. The workbook note says "MBP-1 must be submitted at first Board meeting after appointment".
2. **MBP-1 date.** Recommend the board-meeting date: a new optional `post-1.boardMeetingDate`. When it is blank, leave a blank "Date: ______" rather than printing the SPICe+ date or today.
3. **Subscribers.**
   - Recommend: when `pre-16` is empty, the directors subscribe and the lead enters `sharesSubscribed` per director. **No automatic equal split.** The workbook's own example (1 + 1 shares against 10,000 paid-up) shows the split is not derivable, and that inconsistency should be confirmed with the owner.
   - Show a soft pack warning when Σ ≠ paid-up shares.
   - Specimen card: all proposed directors by default. There is no "employer" flag today; add one only if the owner asks.
4. **Resident sheet trigger.** Recommend deciding **per subscriber, by subscriber type**: an individual gets the individual ("resident") layout and a body corporate or LLP gets the body-corporate ("foreign") layout. Do not decide per engagement by residency and do not use a manual toggle. This is what the firm's two samples actually are (a parent with 9,999 shares plus a resident nominee with 1). An explicit override on Pre-7 is not needed.
5. **Pack-page filters.** Recommend keeping them, hidden when empty. They cost one filter button each, and the pack page is the documented single place to download generated documents.
6. **(New) Witness.** Both samples print the same CA as witness ("Signed before Me"). Should the witness be a firm-level setting printed on every sheet, or left blank for hand-filling? Recommend blank for now, because hardcoding would break the "no sample data" rule.
7. **(New) Page 2 tag shift in the foreign sheet (§1).** Recommend fixing it in Phase 1. This deliberately breaks "byte-identical" for the two subscription sheets, so the Phase 6 parity hashes must be taken *after* this fix, or must exclude these two kinds.
8. **(New) One file or two?** Each subscription-sheet template holds both the MOA page and the AOA page, and the app emits it twice under two names. Should `moa-subscription-sheet` keep only page 1 and `aoa-subscription-sheet` only page 2?

---

## Risks and surprises (where `DOC-GAPS-CONTEXT.md` is wrong or incomplete)

1. **INC-22 is `post-11`, not `post-10`** (§9.2 of the context). `post-10` is Name Board (`checklist.ts:592-605`). The field is `post-11.inc22NewAddress`.
2. **The "resident" template is not an Indian-company sheet.** It is the individual-subscriber layout (the INC-35 nominee of a foreign parent in the sample). It has **no merge tags at all**, so Phase 1 has to tag it from scratch.
3. **The registered foreign template is broken on page 2** (shifted tags), and it has a parent-name tag in the TOTAL row. Phase 1's "foreign output byte-for-byte unchanged" and the Phase 6 parity test would lock in a bug.
4. **`EQUITY_SHARES_SUBSCRIBED` words are wrong** (rupee words for a share count), and the whole paid-up capital is assigned to one subscriber.
5. **`WITNESS_NAME_AND_ADDRESS`** exists on the interface but is not in the key list and not in any template.
6. **Registering MBP-1 or EPFO in `INCORP_DOC_KINDS` leaks them into Pre-7 generate, share and preview and into the Pre-7/Pre-8 slot lists.** That causes S3 writes and a `pre-7` `checklist_state` write, which contradicts rule 4. It needs a stage filter (§5).
7. **Doc-pack counts are not per part today.** The phase pill already shows A+B combined on both rows, and any new part would inflate every pre-inc surface unless the summary is scoped (§5).
8. **`pre-16` individual subscribers have no KYC** (only name, shares and value), so per-subscriber sheets for non-director individuals cannot be filled from existing data.
9. **No structured shareholding or nature-of-interest fields** for MBP-1, and **no designation field** per director (workbook default "Director").
10. **No board-meeting date** anywhere. `post-1` has only agenda and minutes.
11. **`reg-1.forms` is `['PF registration']`, not `[]`.** This is irrelevant to rendering because both steps have response fields, so the legacy forms tab never shows.
12. **Line numbers have drifted.** `subscriptionSheetVariantForDoc` is at `subscription-sheet.ts:73-78` (the context says 72-77). `renderIncorpDocxBuffer` is at `docx.ts:262-289` (the older discovery says 209-234). The per-director audiences are now 6 slots per kind (`audiences.ts:29`), as the new context says; the old discovery §12.5 is stale.
13. **`templates.test.ts` covers only 4 templates.** "Add it to `templates.test.ts`" is the right move, but today's test would not have caught the page 2 shift, because the tags are intact, just in the wrong place.
14. **A parity test already exists** (`src/lib/api/doc-pack-parity.test.ts`), but it compares pack output with Pre-7 output, not before with after. Phase 6's hash fixture is new work.
15. **Workbook bugs (not requirements):**
    - The Dir1 sheet has broken cell references and shows 0 or wrong values.
    - The example's 1 + 1 subscribed shares do not add up to the 10,000 paid-up shares.

**Workbook content for Phases 3 and 5 (as extracted):**
- **MBP-1:**
  - Heading "FORM MBP-1 — Notice of Interest", citing "Section 184(1) & Rule 9(1) — Companies Act, 2013".
  - Addressed "To: {Company Name}".
  - Director block: Name, Father's Name, Residential Address, Designation.
  - Interest table: Sl.No. \| Name of Company / Body / Firm \| Nature of Interest \| Shareholding \| Date of Interest, with 10 blank rows marked "fill manually".
  - Signature block: Name, DIN, Date, Place.
  - Note: "MBP-1 must be submitted at first Board meeting after appointment".
- **EPFO specimen card:**
  - Title "SPECIMEN SIGNATURE CARD FOR UPLOAD WITH THE ONLINE APPLICATION FOR REGISTRATION WITH EMPLOYEES' PROVIDENT FUND ORGANISATION".
  - Subtitle "(This card is for the specimen signature of the employers of the establishment at the time of registration of the establishment with the Employees' PF Organization)".
  - Establishment details: Name and Address of Establishment, then "(Please upload for all employers and for Authorized Signatory if any)".
  - Employer fields: Name of the Employer, Designation.
  - Specimen signature boxes 1, 2 and 3.
  - "For PF Office Use".
- Both match the merge keys proposed in the context. The one exception is MBP-1's `DIRECTOR_DESIGNATION`, which has no source until Phase 4, so default it to "Director".
