# fix-client-home — client Home, Incorporation, Phase, Step, Board resolution (C-001 to C-257)

Round 2. Round 1 had already moved the drill dialog and the toast onto Spectrum (PortalProvider.tsx,
21-runtime.css), started UploadDialog.tsx and modal.tsx (PortalModal). Round 2 checked that work,
finished it and closed the rows below. Only the rows that were ◐ or ✗ are listed.

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-002 | ✓ | Home FRAME: max 1440px, px-4 md:px-8, pt-5 md:pt-7, pb-28 md:pb-20. |
| C-008 | ◐ | Shared: `app/globals.css` and `tailwind.config.ts` (foundations). Request below. |
| C-009 | ◐ | Shared, as C-008. |
| C-010 | ◐ | Shared `DashHeroCompanyTile` (foundations). Request below. |
| C-012 | ✓ | Stage is a plain 20px span, 4px corners, 7px padding, 11.5px, no dot; soft blurple or soft green. |
| C-013 | ✓ | After the COI it reads "N of M done". |
| C-014 | ◐ | Kept "· lead" (real data, hidden on phones). Decision: the client's lead name is useful and not repeated in the card head. |
| C-015 | ◐ | Shared `DashHero` and a missing `--wash-ink-2` token (foundations). |
| C-016 | ✓ | Report fetches the PDF, saves it and toasts "Report downloaded · <file>"; a failure toasts. |
| C-017 | ✓ | Primary "Upload document" (phones "Upload") opens the upload dialog (round 1, checked). |
| C-019 | ◐ | Shared `.wash-tile` (globals.css). |
| C-021 | ◐ | Shared tile icons (`DashHero`, `card-head-icon.ts`). |
| C-022 | ◐ | Shared, as C-021. |
| C-023 | ✓ | Waiting on (teal), With SBC (blurple) and Documents in (green) draw trend lines from stored history only. Documents in: `document_requests.closed_at` (0027). Waiting on: open requests + steps held by the client; With SBC: steps held by the lead or a manager, from `engagement_step_events.holder` (0028), rule in `src/lib/metrics/client-holder-trend.ts`. No line before an engagement's holder baseline; a day with any unknown step or request ends the line. |
| C-024 | ◐ | Due soon keeps its real line (prototype has none after COI); the real line is real data, so it stays. |
| C-026 | ✓ | Note "oldest n days"; before COI the step drill on the "Waiting for" tab; after COI a new needs drill (`needsDrill`). |
| C-029 | ✓ | "x/y", note "n to go", green trend line, share bar. Opens Documents (no separate documents drill; Documents is the list). |
| C-031 | ✓ | Value is the count with "/ N" (`of`), share bar, opens a new registrations drill (`regsDrill`). |
| C-032 | ✓ | Opens the compliance drill on the Due soon tab. Kept the note with the next filing (real data). |
| C-033 | ✓ | Date in ink colour (no green). Kept "day N" note (real). |
| C-034 | ◐ | Shared `DashHero` tooltip. The after-COI sentences are kept (more help, real). |
| C-037 | ◐ | Shared `DashSection` (foundations). |
| C-038 | ✓ | `SCard` passes meta to `DashSection` as muted text right after the title; counts are a grey 4px pill after the title. |
| C-039 | ◐ | Shared `CARD_HEAD_TONE_TOKENS` (teal maps to info). Request below. |
| C-040 | ◐ | Shared `CardHeadTile` icon table. |
| C-041 | ◐ | `SCard` now takes `loading` (DashSection L1 shapes); Home still shows the page skeleton because all cards load from one query. |
| C-043 | ✓ | Real only (error and no-engagement states); kept. |
| C-044 | ✓ | ListChecks blue tile (`headIcon`), "n of N" grey pill after the title, "All steps →". |
| C-045 | ✓ | Real extra: phases are buttons to the phase page; kept. |
| C-047 | ✓ | Step row opens the step page (round 1, checked). |
| C-050 | ✓ | Meta muted after the title; amber "Request pending · COI" pill with popover (`PendingRequestChip`); outline "Edit" with no icon; "Incorporated" chip after COI. |
| C-055 | ✓ | Real only: "Dates not planned yet" empty state; kept. |
| C-056 | ◐ | The #tle editor stays a custom dialog (drag, zoom, compare), but it is on Spectrum tokens now: blurple selected and main button, 15px title, X icon close, line tokens, red/green change chips (`Chip`), Lock icon, dialog shadow, 6px sheet corners, no coloured left edge. A full rebuild on `PortalModal` with the prototype's snap control is not done. |
| C-058 | ✓ | Needs: "Due 9 Oct" amber within a week, blurple later, "Overdue 3d" red; sent back stays red. |
| C-059 | ✓ | Upload dialog: "For" request list with radios, sent-back note, drop zone, file list with refused reasons, one main button; progress rows and the Undo toast follow through `useNeedUpload.sendTo`. DOCX is not offered because the route takes PDF, JPG, PNG. |
| C-060 | ✓ | Fills waiting-mid, brand, identity-mid. |
| C-063 | ✓ | Urgent row: red date tile, soft red fill, "Overdue" chip at the right, navy action; no red left edge. |
| C-064 | ✓ | Rows 16 to 30 days out use a blurple date tile and chip. |
| C-065 | ✓ | Every row links, so every row has a chevron; rows without a stored % show no bar (real). |
| C-066 | ✓ | `docGroup` groups by age: under 7 days, under 14, earlier. |
| C-067 | ◐ | Size added. MCA violet sender stays out: documents store only client or firm as the source. |
| C-068 | ✓ | 16px FileText icon, name, KB, bar with %, Uploaded tick; failed reason and Cancel kept (real). |
| C-071 | ✓ | Date (India day) and the time from 768px. |
| C-073 | ◐ | Not changed this round (row parts already match; the sub line keeps the relative due words). |
| C-075 | ✓ | Compliance buttons open the Spectrum drill (`complianceDrill`, round 1, checked). |
| C-076 | ◐ | EyeOff hide needs a hide action from `credentials/IdsRevealDialog.tsx` (credentials area). Request below. |
| C-077 | ✓ | Director name inline after the DIN. The MCA portal link is kept (real, useful). |
| C-079 | ◐ | Footer now "1–n of n · Total…". AreaPill and the per-bucket Mix bar are kept: the bar segments open their drill tab (real). |
| C-082 | ✓ | Pager: "1–8 of N", previous and next arrows, page buttons, current page solid blurple. |
| C-084 | ✓ | Drill is `PortalModal` with SpectrumTabs, rows with name, mono meta, 104px tone chip, chevron, footer "Showing…" and "Open … ›" (round 1, checked). |
| C-085 | ✓ | A1 white toast (kind) and A2 dark line toast with Undo, both on tokens inside the portal root (round 1, checked). |
| C-086 | ✓ | Real extra (messages card); kept. |
| C-089 | ✓ | No literals left in the drill or in home-tle.css except the white lock stripes on a filled bar. |
| C-091 | ✓ | Incorporation root padding 20px 16px 112px, 28px 32px 80px from 768px; `.wrap` max 1440px. |
| C-093 | ✓ | Entry motion removed. |
| C-096 | ✓ | Count-up removed; the title stays a button to the SPICe+ drill (real extra). |
| C-097 | ✓ | Real only; kept. |
| C-099 | ✓ | Real ids drive the "issued" line; the steps drill button is a real extra. |
| C-101 | ✓ | Real only (Status brief); kept. |
| C-102 | ✓ | Real only (Board resolution link); kept. |
| C-104 | ✓ | Real only; kept. |
| C-107 | ✓ | Fixed in `SCard` (see C-038). |
| C-108 | ✓ | `SCard` takes and passes `loading`. |
| C-109 | ◐ | Page-level skeleton kept: one query feeds every card. |
| C-110 | ✓ | Real only; kept. |
| C-111 | ✓ | ListChecks blue tile via `headIcon`. |
| C-112 | ✓ | Grey 4px pill right after the title. |
| C-114 | ✓ | Real extra: Registration is a real fourth phase; kept. |
| C-117 | ✓ | Real extra: phase columns open the phase page; kept. |
| C-126 | ✓ | Real extra, as C-114. |
| C-128 | ✓ | Muted meta "5 to 11 Oct". |
| C-130 | ◐ | Kept 500: the real type scale uses 500 as the top weight. |
| C-133 | ✓ | No track colour. |
| C-136 | ✓ | `PortalModal` (round 1, checked). |
| C-137 | ✓ | SpectrumTabs with counts. |
| C-138 | ✓ | Step rows: 20px StepMark, mono "Step n", title, date line red when late, OwnerChip, 104px chip, chevron. |
| C-140 | ◐ | Footer keeps "Showing…" plus the "Open … ›" link, as C-084 asks; the two rows disagree. |
| C-141 | ✓ | Dashed "None". |
| C-142 | ✓ | Waiting, In progress, With SBC, Done, Upcoming. |
| C-143 | ✓ | Bottom sheet under 640px, 6px top corners. |
| C-144 | ✓ | Tokens only. |
| C-145 | ✓ | Meta muted text after the title (SCard). The tile tone is shared (C-039). |
| C-146 | ✓ | sm outline "Edit", no icon, hidden after the COI. |
| C-147 | ✓ | "Incorporated" chip replaces Edit. |
| C-148 | ✓ | Pending pill and popover (Waiting for, COI, Reason, Sent, Withdraw), from `/api/client/home` (`useHomeQuery`, now exported). |
| C-149 | ◐ | As C-056. |
| C-150 | ✓ | Real extra (fourth phase); kept. |
| C-151 | ◐ | Shared `--row-height` / `h-row` (foundations). |
| C-155 | ✓ | Real extra: the bar opens the phase drill; kept. |
| C-160 | ✓ | Real extra: green "n days early" added to the prototype's red late; kept. |
| C-161 | ✓ | `rounded-sm` is the real 6px small radius; the line and tag match. |
| C-162 | ◐ | The full StepTable is kept in the expanded row (it carries the portal and proof actions). |
| C-164 | ◐ | Kept the phase status drill: one tab per status reads better than one tab per bar. |
| C-165 | ✓ | Real only; kept. |
| C-166 | ✓ | Real tooltip layer; kept. |
| C-170 | ✓ | Real phase names come from the model; kept. |
| C-172 | ✓ | Real only; kept. |
| C-173 | ✓ | Real extra (phase 4); kept. |
| C-174 | ✓ | Meta is muted text now (SCard). |
| C-177 | ✓ | Real extra (green early days); kept. |
| C-180 | ✓ | Meta is muted text now (SCard). |
| C-181 | ✓ | Portal column 110px. The Ask column is a real extra. |
| C-184 | ✓ | Real extra (teal for waiting, red for late); kept. |
| C-185 | ✓ | Focus row full `bg-brand-soft`. |
| C-186 | ✓ | A late client step row reads red (`late` class, name red); the date cell stays red too. |
| C-189 | ✓ | "Done 24 Sep", "Due 9 Oct", "Since 1 Oct", "Planned 12 Oct", "Exp. 21 Oct", "—". |
| C-190 | ✓ | Real proof chips and counts are kept; button looks match. |
| C-191 | ✓ | Footer "1–n of n" under the phase table (a phase never needs a second page). |
| C-192 | ✗ | Not done: the table sits in a sideways scroll box, so a sticky head would need the shared table to scroll inside the page instead. |
| C-193 | ✓ | Mark and step name columns stick on the left while the table scrolls sideways. |
| C-194 | ✓ | Real extra; kept. |
| C-195 | ✓ | ListChecks blue tile, muted meta "d / n". |
| C-197 | ✓ | Real extra (long phases fold around the focus); kept. |
| C-199 | ◐ | Meta removed. Segments and legend stay separate buttons (each opens its own tab). |
| C-200 | ✓ | No track colour (a grey track only when every value is 0). |
| C-201 | ✓ | Spectrum drill. |
| C-202 | ◐ | As C-109. |
| C-206 | ✓ | Portal rules are real; kept. |
| C-207 | ✓ | Real only; kept. |
| C-209 | ✓ | Meta is muted text now. |
| C-211 | ✓ | Real extra; kept. |
| C-213 | ◐ | Kept the per-label note: fields can come from different steps, so one strip would be wrong. |
| C-215 | ✓ | Typography: the real tool uses "—"; kept. |
| C-216 | ✓ | Already a blurple text link with an icon. |
| C-218 | ✗ | Client answer editing is not built: DECISIONS keeps answers read-only for the client, and a client draft save route does not exist. |
| C-219 | ✗ | Not built: a step-scoped message needs the messages thread to take a step reference. The "Message <lead>" card on Home exists. |
| C-223 | ✓ | "Approve", then "Approved". |
| C-225 | ✓ | `PortalModal` sm: eyebrow "Step n · title", "Request a change · <lead>", "Message" label, field with focus ring, Cancel and the main Send. |
| C-227 | ◐ | "Sent back" and "Asked" chips need the request's review state on the step DTO; not changed. |
| C-229 | ◐ | Chip words follow the stored file state (Checked, Uploaded); "To review" and "Sent back" need a file review status that is not stored. |
| C-230 | ◐ | Shared `FileBadge` (foundations). |
| C-231 | ✓ | ListChecks blue tile, muted meta "d / n". |
| C-233 | ✓ | Real extra; kept. |
| C-236 | ✓ | Real only; kept. |
| C-237 | ◐ | As C-109. |
| C-241 | ✓ | Real only; kept. |
| C-243 | ✓ | Real only; kept. |
| C-244 | ✓ | Meta is muted text now; quiet buttons are the real ghost. |
| C-245 | ✓ | Grey tray (p-3, p-5 from 768px, max 760px, scrolls), page on a 1px line. |
| C-246 | ✓ | Real: the actual Word file is rendered; kept. |
| C-247 | ✗ | No signature drawn: the preview is the real Word draft; a drawn signature would be fake. The signed copy is the uploaded file. |
| C-248 | ✗ | No stamp, for the same reason. |
| C-249 | ◐ | Kept a white page in dark mode: it previews a printed Word page. |
| C-250 | ✓ | Real only; kept. |
| C-255 | ◐ | Words match ("Signed copy uploaded · <lead> will check it"); no Undo because the board upload has no undo route. |
| C-257 | ✓ | Real only; kept. |

## Files changed

- src/components/client-portal/pages/home/CardsA.tsx — home card tiles, drills, report download, needs due words, holds, alerts, uploads, docs size, activity time.
- src/components/client-portal/pages/home/CardsB.tsx — timeline head (pending pill, outline Edit, Incorporated), registrations pager, area footer, DIN inline.
- src/components/client-portal/pages/home/HomePage.tsx — frame (round 1 wiring of the upload dialog checked).
- src/components/client-portal/pages/home/derive.ts — `docGroup` by age, `needsDrill`, `regsDrill`.
- src/components/client-portal/pages/home/PendingRequest.tsx — `PendingRequestChip`.
- src/components/client-portal/pages/home/TimelineEditor.tsx — token colours, Lock and X icons, Chip in the change table.
- src/components/client-portal/pages/home/useHome.ts — exports `useHomeQuery`.
- src/components/client-portal/pages/home/UploadDialog.tsx, ui.tsx — round 1, checked.
- src/components/client-portal/pages/incorporation/spectrum.tsx — `SCard` meta after the title, `pill`, `loading`, `headIcon`; St5Card head; StackedBar track.
- src/components/client-portal/pages/incorporation/Landing.tsx — head without count-up, week range words, split bar, timeline head with the pending pill.
- src/components/client-portal/pages/incorporation/StepPage.tsx — change request dialog on `PortalModal`, approve words, rail head icon.
- src/components/client-portal/pages/incorporation/PhasePage.tsx — journey icon, Who card meta.
- src/components/client-portal/pages/incorporation/StepTable.tsx — sticky left columns, focus row, late rows, Portal width, footer count.
- src/components/client-portal/pages/incorporation/data.ts — date words.
- src/components/client-portal/pages/incorporation/modal.tsx — round 1, checked.
- src/components/client-portal/css-src/home-tle.css, incorporation-pages.css, incorporation-extra.css (+ regenerated css/).
- src/lib/metrics/client-docs-trend.ts and .test.ts (new) — the Documents in trend rule.
- src/db/repositories/home-trends.ts — client trends add `docsIn` (one more query, same access check). This file is shared with the staff home agent; the edit is limited to `clientTrends`, the import and the header comment.
- src/db/repositories/home-trends.test.ts — one client test for `docsIn` and its engagement scoping.
- Round 1 (checked, kept): src/components/client-portal/PortalProvider.tsx, css-src/21-runtime.css, src/db/repositories/client-home.ts (`closed_at` on fulfil and undo).

## New routes

None.

## Schema needs

None left. Round 3 uses `engagement_step_events.holder` (migration 0028).

## Round 3: holder trend lines

- `src/lib/metrics/client-holder-trend.ts` (+ test): `holderChanges` (write side), `holderAsOf`, `holderCountsAsOf`, `openRequestsAsOf`, `modelStepIds`.
- `src/db/repositories/engagements/write.ts` (already committed in 6314c5d5; it imports the untracked `client-holder-trend.ts`, so that file must be committed with it): a gated step can change hands without a status change of its own, so each save adds holder-only rows (from = to status) for every model step whose holder moved. The first save with no holder history writes a baseline row for every model step. Those rows keep the review state only when it is "reviewing", so the super admin approvals count does not double.
- `src/db/repositories/home-trends.ts` `clientTrends`: one more query (the engagement's step events, same access check), series `waiting` and `withSbc`. Tests cover the tenant check and the "no history" case.
- `derive.ts` `buildNeeds`: a client step the client has started (kind `prog`) is now a "Fill" need, so the Waiting on tile counts what the holder rule calls client. `CardsA.tsx` draws the two lines.
- `sbc` (step not open yet) counts in neither tile, matching the live With SBC count (kind `with`).
- Deploy note: ship the write.ts change with migration 0028 so the holder history starts complete. An engagement draws these lines from about four days after its first save.

## Requests for shared files

- Foundations: C-008/C-009 wash (`backgroundImage.wash` in tailwind.config.ts), C-010 company tile (soft fill, blurple text), C-015 `--wash-ink-2`, C-019 `.wash-tile` blur, C-021/C-022 tile icons per label, C-037 DashSection padding, C-039 teal head tone, C-040 FileText glyph, C-151 row height 44px, C-230 FileBadge weight.
- Credentials: an exported hide action for a revealed PAN or TAN, so the Home IDs card can show EyeOff (C-076).
- Shell: SearchPalette still uses the old `#vp-drill` frame (its CSS is on tokens now, in 21-runtime.css).

## Decisions

- Kept real extras the prototype lacks (phase 4, phase buttons, Ask column, status brief, early days, error states).
- Documents in trend: a request answered before migration 0027 has no `closed_at`, so the line starts only once every answered request is stamped. No estimate.
- The old StepPopup and CompliancePopup stay in Popups.tsx unused (no deletions); MobileHome files are not rendered anywhere.

## Checks

- `npx tsc --noEmit -p .`: clean for my files. Errors remain in other areas (src/views/compliances, src/views/admin/FirmProjectsPanel.tsx, src/views/super/SuperPracticeIncorporation.tsx, app/app/admin and manager missing views).
- `npx vitest run` on src/components/client-portal, src/lib/client-portal, src/lib/client, src/lib/metrics, src/db/repositories/home-trends.test.ts: all pass.
- `npx eslint` on my files: 0 errors (warnings are react-refresh and React compiler notes).
