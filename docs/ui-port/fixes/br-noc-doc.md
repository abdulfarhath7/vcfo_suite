# Board resolution (NOC): shared document part (30 Oct 2026)

Branch `feat/br-noc`. Scope: spec section 5 of the prototype's `docs/BOARD-RESOLUTION-NOC.md`, the
document parts that the client page (C2, C4 to C8) and the staff page (T4, T5) use. The API is in
`docs/ui-port/BR-DOC-API.md`. Nothing outside `src/components/board-doc/` and the two docs changed.

## 1. Files

| File | What it holds |
|---|---|
| `docs/ui-port/BR-DOC-API.md` | The API the other two agents code against (written first). |
| `src/components/board-doc/index.ts` | One import path, `@/components/board-doc`. |
| `types.ts` | Shared types: stages, records, to-do lines, checks, document type, merge value, model, version, file, signed copy, audit line, evidence row. |
| `format.ts` | `docDay` ("14 Oct", India date), `docDate`. |
| `doc-types.ts` | `nocDocType(variant, { notary })` (6 or 4 steps, 5 or 4 to-do lines, 6 or 4 checks), `needsNotary`, `NOC_STAGE_KEYS`, `UPLOADED_KEY`, and `DOC_TYPES` for resolution by circulation, notice and agenda, and minutes. |
| `track.ts` | `trackStates`, `todoStates`: done, now and next from one record per step (P2). |
| `merge-segments.ts` | `segmentText` (longest value first, no overlaps), `isPlaceholder`. |
| `version-diff.ts` | `diffValues` for the version compare. |
| `noc-doc.ts` | `nocMergeValues`, `nocDocModel` (margin labels and Meeting / Certified dates from the stored or generated draft), `nocEvidence` (rows, outcome, variant and tree path from the three project answers), `plainDocDate`, `NOC_FIELD_SOURCES`, `NOC_FIELD_LABELS`. |
| `signed-kind.ts` | `signedKind`: pdf, image or other. |
| `DocTrack.tsx` | ST5 strip; two columns on phones, three on tablets, one row from `lg`. |
| `DocTodo.tsx` | Numbered "What you do" list with the one main button in the foot. |
| `DocPaper.tsx` | Draft tab: letterhead band (or a plain page), heading, dated labels, margin labels, tinted values that open their field or name it. |
| `SignedCopyView.tsx` | Signed copy tab: the uploaded PDF in a frame (same-origin routes fetched as a blob, because they send `attachment`), an image, or Open for other types. Empty state "No signed copy yet". |
| `DocPreviewCard.tsx` | Card with the Draft and Signed copy tabs (`SpectrumTabs`, so the tab-switch event still reaches parent cards). |
| `VersionCompare.tsx` | Two compact selects and the changed values, "before → after". |
| `ReceiveChecklist.tsx` | "n of total" tag, Accept locked until every check is ticked, Send back with a required reason. |
| `DocFiles.tsx` | File rows; the internal file name shows only with `showInternalName` (P5). |
| `EvidenceTable.tsx` | # · VCFO asked · The answer · So VCFO chose, with the result line; rows stack on phones. |
| `AuditLines.tsx` | Audit lines, newest first. |
| `board-doc-helpers.test.ts`, `board-doc.test.tsx` | 41 tests. |

## 2. Built

All the parts above. They are presentational: they take data and callbacks, fetch only the signed
copy bytes, and write nothing. Tokens only (no hex), so light and dark both work. No part draws a
signature or a seal (tests check that the paper and the empty signed view hold no svg, canvas, image
or frame). Spec section 7 cases covered here: 6 steps for a foreign parent and 4 for an Indian parent;
`nocEvidence` lights the same path as `resolveNocVariant()` for foreign, Indian name use, Indian
investing, Indian not chosen and standalone; the client never sees the internal file name; Accept is
disabled until every check is ticked; Send back needs a reason.

## 3. Checks

- `npx tsc --noEmit -p .`: clean.
- `npx vitest run src/components/board-doc`: 2 files, 41 tests pass.
- `npx eslint src/components/board-doc`: 0 errors, 0 warnings.

## 4. Gaps (need data or backend from the data agent)

- Stage records for `notarised`, `apostilled`, `accepted` and `uploaded` do not exist on
  `BoardResolutionDoc` yet; today only `draftedAt`, `finalizedAt` (released) and `signedUploadedAt`
  exist. The track and the to-do list show whatever records the page passes.
- Versions with their merge values (for `VersionCompare`) and audit lines (for `AuditLines`) need storage.
- The notary switch (D1, `nocDocType(variant, { notary: false })`) needs a per-client setting.
- Letterhead from Pre-1: there is no uploaded letterhead image, so `DocPaper` draws a plain band with
  the parent's name and address (or a plain page when the name is unknown).

## 5. Notes for the hub and the other agents

- The client page's current `SignOff` block in `BoardPage.tsx` draws a signature line and a stamp ring.
  P7 and R-52 say never to draw them; the client agent should remove it when it adopts `DocPaper` and
  `SignedCopyView`.
- `DocPaper` renders the draft text from `BoardResolutionDoc.content` (or `generateBoardResolutionDraft`),
  not the Word file. The existing `BoardResolutionDocPreview` (docx render, zoom, editing) is untouched;
  the staff editor keeps using it.
- Both dates on the paper come from the one Pre-1 board resolution date today, so Meeting and
  Certified show the same day until a separate certified date is stored. `nocDocModel` takes `dates` to override.

## 6. Decisions made alone

- To-do ticks: lines 1 to 3 tick on Signed, line 4 on Apostilled, line 5 on the `uploaded` record;
  a later done step ticks every earlier line, and Accepted ticks all.
- Margin labels come from the paragraph openings of the three current templates (Purpose for "THE
  FOLLOWING…", Decision for "RESOLVED THAT" and most "RESOLVED FURTHER THAT", Who signs for the bare
  "RESOLVED FURTHER THAT." before the director list, Filing agent for the action list and the
  name-use NOC's submission clause, Certifies for the true-copy clause and the sign-off block).
- Field sources read "Pre-1 · …" as in the prototype; DIN reads "Filled by hand on the printed copy".
- A value the viewer cannot edit shows a small inline note ("From Pre-1 · Parent company name") on
  click or Enter, and closes on blur or Escape.
- The paper uses the surface tokens (it turns dark in dark mode) rather than a fixed white sheet,
  because the brief forbids fixed colours.
