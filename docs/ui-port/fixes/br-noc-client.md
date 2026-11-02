# Board resolution (NOC): client page (C1 to C8)

Agent: br-noc client, 30 Oct 2026, branch `feat/br-noc`. Spec: the prototype's
`docs/BOARD-RESOLUTION-NOC.md` sections 1, 2, 3 and 7, and rule R-52. Built on the data contract
in `docs/ui-port/BR-NOC-API.md` and the shared part in `docs/ui-port/BR-DOC-API.md`.

## Files

- `src/components/client-portal/pages/incorporation/BoardPage.tsx`: rebuilt as the NOC page.
- `src/components/client-portal/pages/incorporation/board/noc.ts` (new): pure helpers. Stage records from the NOC route with a fallback to the existing board-resolution data, the phase and the one main button, and the variant label.
- `src/components/board-doc/VariantTree.tsx` (new, shared part): C8. The SVG tree. The page owns the Replay button and bumps `replayKey`.
- `src/components/board-doc/variant-tree.ts` (new): `treePath()` and `NocNodeId`, built on the shared `nocEvidence()`.
- `src/components/board-doc/VariantTree.module.css` (new): the tree styles. Tokens only (`oklch(var(--brand))` and so on), so they work inside and outside the `.cp` scope, in light and dark, with reduced motion.
- `src/components/board-doc/index.ts`: exports `VariantTree`, `treePath` and `NocNodeId`.
- `src/views/intern/board-resolution-noc/NocStaffCards.tsx`: the staff "Why VCFO chose this template" card now shows the same tree with a Replay button above the evidence table (D5).
- `src/views/intern/board-resolution-noc/NocStaffCards.test.tsx`: one test for the staff tree.
- `src/components/client-portal/pages/incorporation/board/board-page.test.tsx` (new): 13 tests.
- `src/components/client-portal/css-src/incorporation-extra.css`: unchanged. The tree styles first went here and then moved to the CSS module.
- `e2e/smoke.spec.ts`: the client route `/app/client/board-resolution` now runs `clientBoardResolution` (the heading, "Passed by", the tree, Replay, the evidence row).

## What the page does

- C1: title "Board resolution (NOC)" with the status chip; the variant label as the subtitle; "Passed by: Board of {parent} (the parent) · Phase 1 · Steps 2–3". The parent name is the Pre-1 answer, then the NOC route's `parentName`, then the engagement's; never the new company's own name. "Previous step" and "Next step" only (the step 2 and 3 links are gone, P6). "What's this?" stays.
- C2: `DocTrack` with `nocDocType(variant, { notary: !notaryStepsOff })`. Six steps for a foreign parent, four for an Indian parent. Dates and names come from the NOC route's `track`. When that route answers nothing (an older deploy), the records come from the board-resolution row and step 3, as before. That fallback has no notary or apostille record, so those two steps stay open.
- C3: the Key facts card. New company (Pre-1 proposed name 1, else the engagement name), capital (Pre-1 authorised, paid up and the value of a share), shares (the parent and the Pre-16 INC-35 nominee with one share; for the name-use NOC, "lends its name only"), who signs (Pre-1 signatory and designation), who files (SBC), and the template label. A missing value shows "Not given yet" in faint ink.
- C4: `DocTodo` from `todoStates()`. One main button: Released gives "Download the Word file"; scan sent gives "Upload signed copy" (a file picker); Accepted gives no button. A send back shows its date and reason in the same card. This is not a page bar.
- C5: the Draft tab uses `DocPaper` with `nocDocModel()` and `nocMergeValues()` from the existing merge fields, so the filled values are tinted. It has the margin labels and the Meeting and Certified dates. A click opens step 1 while the client can still change it there (`pre-1` waiting on the client). Otherwise the paper names the source. When the stored draft has no text, the existing live Word preview shows, and it also tints the merge values. Zoom and full screen are kept.
- C6: the Signed copy tab is `SignedCopyView` with the uploaded file only. The old drawn signature line and stamp ring (`SignOff`) are removed (P7). With no upload it shows "No signed copy yet".
- C7: `DocFiles` with the titles "Draft · Word" and "Signed copy". There is no internal file name. The download saves as "Board resolution (NOC).docx", and the viewer shows the same name. The replace drop zone stays until Accepted.
- C8: the shared `VariantTree` from `@/components/board-doc`, used on the client page and on the staff card, so everyone sees the full tree (D5). The chosen path is in brand colour with the numbered badges and "CHOSEN". The other branches are grey. "Not chosen yet" and "No NOC yet" are grey and dashed. Replay walks the path in about one second, and with reduced motion it shows at once. The shared `EvidenceTable` shows the "Project setup · …" rows and "This choice adds 2 steps: Notarise · Apostille", or "no steps". The tree also shows before the draft is ready.
- These features are kept: realtime reload (it now also refreshes the NOC query), the upload toast, the document viewer pop-up, the skeleton, and every animation.

## Checks

- `npx tsc --noEmit -p .`: clean.
- `npx eslint` on the changed files: 0 errors, 0 warnings.
- `npx vitest run src/components/client-portal src/components/board-doc src/views/intern/board-resolution-noc`: 10 files, 94 tests pass.
- The prototype spec at main e626146 is the same as the copy the page was built from.
- The tests cover: the head shows "Passed by"; the track has 6 steps for a foreign parent and 4 for an Indian parent, from the route and from the fallback; the four tree cases light the `resolveNocVariant()` result and only that one; the Draft tab tints the values; the client never sees any internal file name, even when a response carries `staff.templateFileName`; and the main button in each phase; Replay dims the path and lights it again in about one second; the staff card draws the same 13-node tree with the chosen path lit.

## Gaps

- Notarised and Apostilled show done with a date only when staff tick the receive checks (data contract). The page does not draw them as done on upload.
- The parent's real letterhead (a logo or image) is not collected in Pre-1. The Draft tab uses `DocPaper`'s default, which is the parent's name and address.
- "Files the forms" shows "SBC". No field holds the filing firm's legal name.

## Decisions made alone

- When the Indian parent's role is not chosen, the subtitle is the NOC route's label (generation falls back to the foreign template). Without the route, the subtitle is "NOC · parent's role not chosen yet".
- The click on a value goes to step 1 only while that step waits on the client. After that the paper names the field.
- The crumb and the tab title now read "Board resolution (NOC)".
