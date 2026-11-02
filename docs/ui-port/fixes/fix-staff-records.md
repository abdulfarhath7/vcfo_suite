# fix-staff-records (round 2)

Rows S-268 to S-357 and S-403 to S-580.

| No. | New status | What you did, or why it stays |
|---|---|---|
| S-268 | ✓ | Already matched. |
| S-269 | ◐ | Sidebar and tab bar are shell-owned; request filed (Clients item with count and fold). |
| S-270 | ◐ | Sidebar and tab bar are shell-owned; request filed (Clients item with count and fold). |
| S-271 | ◐ | Sidebar and tab bar are shell-owned; request filed (Clients item with count and fold). |
| S-272 | ✓ | Already matched. |
| S-273 | ✓ | Saved views moved to their own row under the head (intern/Clients.tsx). |
| S-274 | ◐ | Views still filter on the lead's real work items (overdue, due this week, client-tagged); kept on purpose, Health and Next chips give the prototype filters. |
| S-275 | ✓ | Stage tabs are always All, Incorporating, Compliance with counts, from `clientRowFacts` (isIncorporated). |
| S-276 | ✓ | Dashed "+ Health" (six words + Done) and "+ Next" (This week, Next week) FilterChips. |
| S-277 | ✓ | Dashed "+ Health" (six words + Done) and "+ Next" (This week, Next week) FilterChips. |
| S-278 | ✓ | 30px client tile in the identity colour, name, contact line; 240px column. |
| S-279 | ✓ | Contact line from `engagement.clientDisplayName`; hidden in compact rows (`grid-sub`). |
| S-280 | ✓ | Violet Incorporating / teal Compliance, no dot, fixed. |
| S-281 | ◐ | PhaseBar is a shared part (foundations); no red stuck tone yet. Request filed. |
| S-282 | ◐ | Bars are not links; needs a `hrefFor` prop on the shared PhaseBar (request). |
| S-283 | ✓ | `NowCell`: 8px holder square (amber client, blue SBC, violet MCA), mono code, step name. |
| S-284 | ✓ | `NowCell`: 8px holder square (amber client, blue SBC, violet MCA), mono code, step name. |
| S-285 | ◐ | Faces still blurple-soft: AvatarStack is a shared part (request: hashed palette). |
| S-286 | ✓ | "Steps n/m" column, right aligned, 13px muted. |
| S-287 | ✓ | Already matched. |
| S-288 | ✓ | Already matched. |
| S-289 | ✓ | Already matched. |
| S-290 | ✓ | Already matched. |
| S-291 | ✓ | Already matched. |
| S-292 | ◐ | Export stays a real CSV download (real feature); columns now Client, Contact, Stage, Now, Steps, Next, Health, Status. |
| S-293 | ◐ | Quick actions stay in the row-actions column (EFilingGrid shared layout). |
| S-294 | ✓ | "..." menu with Copy link on the lead grid. |
| S-295 | ✓ | C copies the link; Enter, Space, R kept. |
| S-296 | ◐ | EFilingGrid is a shared part (foundations); not changed here. |
| S-297 | ✓ | Already matched. |
| S-298 | ✓ | Already matched. |
| S-299 | ◐ | EFilingGrid is a shared part (foundations); not changed here. |
| S-300 | ✓ | "No clients match these filters" on grid and phone. |
| S-301 | ✓ | Already matched. |
| S-302 | ◐ | EFilingGrid is a shared part (foundations); not changed here. |
| S-303 | ✓ | `ClientsLegend` under the lead, manager and admin grids (lg and up). |
| S-304 | ◐ | EFilingGrid is a shared part (foundations); not changed here. |
| S-305 | ✓ | Already matched. |
| S-306 | ✓ | Phone row: tile, name, status; holder, code, step; phase bar, n/m; stage chip, Next date, avatars; chevron. |
| S-307 | ✓ | "Next 19 Oct" from the next manager window end. |
| S-308 | ✓ | Already matched. |
| S-309 | ✓ | Client tiles use `clientIdentityTone` (token pairs that flip in dark mode). |
| S-310 | ✓ | Page head removed; the grid card is titled "Clients"; Table/Board, Deleted and Start GCC project sit in the card head. |
| S-311 | ✓ | Card head: icon tile, "Clients", "n of N"; stage tabs and filter chips in the row under it. |
| S-312 | ✓ | "My overdue" label (clients-table-tools). |
| S-313 | ✓ | Stage tabs with counts, Health and Next chips. |
| S-314 | ✓ | Stage tabs with counts, Health and Next chips. |
| S-315 | ✓ | Operational Readiness engagements are no longer dropped (Projects.tsx). |
| S-316 | ✓ | Columns Client, Stage, Phases, Now, Team, Steps, Status, settings. |
| S-317 | ✓ | 30px identity tile. |
| S-318 | ✓ | Second line is the contact; the stuck reason moved to the status chip tooltip. |
| S-319 | ✓ | "Phases" column with ST5 bars; plain bar only when phases are missing. |
| S-320 | ✓ | Now column with holder square, code, step. |
| S-321 | ✓ | Team avatar stack of the leads. |
| S-322 | ✓ | Status chip with the six health words from `clientRowFacts`. |
| S-323 | ✓ | Already matched. |
| S-324 | ◐ | Quick actions in the row-actions column (shared EFilingGrid layout); Reassign moved into the "..." menu. |
| S-325 | ✓ | "..." menu Reassign shows the lead side list with a tick on the current lead (first round). |
| S-326 | ◐ | Project settings menu kept (real features); row "..." menu adds Reassign and Copy link. |
| S-327 | ✓ | Enter, R, A, C. |
| S-328 | ◐ | Reassign dialog is the Work agent's file (no faces or hours: no hours data). |
| S-329 | ◐ | Board view kept (real only). |
| S-330 | ✓ | Fake hashed city removed; the board card shows the stored registered address only when set. |
| S-331 | ◐ | SkeletonRows kept; grid shapes need EFilingGrid (shared). |
| S-332 | ✓ | "No clients match these filters" with "Clear filters"; empty firm keeps "Start GCC project". |
| S-333 | ✓ | Phone card: tile, name, health; Now; phase bar, n/m; lead and Next date; team stack. |
| S-334 | ✓ | Already matched. |
| S-335 | ◐ | Work page frame is the Work agent's (FirmProjects.tsx). |
| S-336 | ◐ | Kept as chips and saved views (owner prefers few compact dropdowns). |
| S-337 | ◐ | Phase tabs kept; Incorporating/Compliance scope comes from home tiles. |
| S-338 | ✓ | Health chip with the six words added beside Status (stuck reasons). |
| S-339 | ◐ | No separate Next select; the "This week" view covers it. |
| S-340 | ✓ | Already matched. |
| S-341 | ◐ | Kept as chips and saved views (owner prefers few compact dropdowns). |
| S-342 | ✓ | "Assign client" button opens `AssignClientDialog` (firm-wide admins). |
| S-343 | ✓ | Every client shows, worst health first (six-word rank). |
| S-344 | ✓ | 30px identity tile. |
| S-345 | ✓ | Step name medium, mono code on a second line with the holder square. |
| S-346 | ✓ | Already matched. |
| S-347 | ✓ | Already matched. |
| S-348 | ◐ | Leads stack kept (several leads per client in the real tool). |
| S-349 | ✓ | Violet/teal stage chip without a dot. |
| S-350 | ✓ | Already matched. |
| S-351 | ✓ | Six-word health chip; stuck reason as tooltip. |
| S-352 | ◐ | Settings menu column kept (real features). |
| S-353 | ✓ | Bulk Assign picks a manager (first round `assignTo`, wired now). |
| S-354 | ✓ | Row Reassign opens "Assign a client to a manager" on that client. |
| S-355 | ✓ | `AssignClientDialog` with client select and manager cards with load. |
| S-356 | ✓ | Phone cards under 768px. |
| S-357 | ✓ | "No clients match these filters" without the full stop. |
| S-403 | ◐ | Firm-people screens belong to the people agent; not in my file list. |
| S-404 | ◐ | Firm-people screens belong to the people agent; not in my file list. |
| S-405 | ◐ | Firm-people screens belong to the people agent; not in my file list. |
| S-406 | ◐ | Two routes remain, but both now render the same parts (RecordMetaLine, RecordNumbers, RecordTimelineCard, RecordStepsCard, RecordTabs). |
| S-407 | ✓ | RecordTile takes the identity colour on both records. |
| S-408 | ✓ | RecordTile takes the identity colour on both records. |
| S-409 | ✓ | Already matched. |
| S-410 | ◐ | Stage chip uses the stored stage (three values); list screens use Incorporating/Compliance. |
| S-411 | ✓ | `RecordMetaLine`: contact · email · Manager · Project lead. |
| S-412 | ✓ | Already matched. |
| S-413 | ✓ | `RecordMetaLine`: contact · email · Manager · Project lead. |
| S-414 | ✓ | `RecordMetaLine`: contact · email · Manager · Project lead. |
| S-415 | ✓ | "Reassign" opens ReassignDialog (whole client to another lead) for managers and admins. |
| S-416 | ✓ | Firm-wide admins get "Change manager" (AssignClientDialog preselected). |
| S-417 | ✓ | Outline "Documents n" button opens the Documents tab. |
| S-418 | ✓ | "Step n of m" on both records. |
| S-419 | ✓ | "Step n of m" on both records. |
| S-420 | ✓ | "n days to COI" from `expected_coi_on` before the certificate. |
| S-421 | ✓ | "nd with <holder>" from the step model's `since`. |
| S-422 | ✓ | Now link with mono code, title and "Waiting on client" / "With MCA" / "With SBC" (Overdue when late). |
| S-423 | ✓ | Now link with mono code, title and "Waiting on client" / "With MCA" / "With SBC" (Overdue when late). |
| S-424 | ◐ | Window and COI controls moved into "Edit the timeline"; Escalate kept in the head. |
| S-425 | ✓ | Already matched. |
| S-426 | ✓ | Lead tab shows "cur/total". |
| S-427 | ◐ | Manager tab keeps "done/total" across all steps. |
| S-428 | ✓ | Already matched. |
| S-429 | ◐ | Obligations count needs the register query in the tab bar; not added. |
| S-430 | ✓ | Documents tab with count (`/api/documents?engagementId=`). |
| S-431 | ✓ | Already matched. |
| S-432 | ◐ | `?tab=` kept; no `?phase=`. |
| S-433 | ✓ | Timeline card with the shared Gantt on every staff record. |
| S-434 | ✓ | Compliance-stage rows with counts and Overdue notes (timeline-model). |
| S-435 | ✓ | "Edit the timeline" dialog for managers/admins; leads read only (no stored per-row plan dates). |
| S-436 | ✓ | Same dialog for managers and admins. |
| S-437 | ✓ | Section card heads with icon tiles. |
| S-438 | ✓ | Section card heads with icon tiles. |
| S-439 | ✓ | Meta "x of y done · Step n of m". |
| S-440 | ✓ | "Open current step ›". |
| S-441 | ✓ | Steps card with phase track and step list on manager and admin records. |
| S-442 | ✓ | Already matched. |
| S-443 | ✓ | "Steps 1–n" range under each bar. |
| S-444 | ✓ | Partly done later phase fills faint grey. |
| S-445 | ✓ | Phone line adds the range. |
| S-446 | ✓ | Already matched. |
| S-447 | ◐ | Window and doc pack line kept (real data). |
| S-448 | ✓ | Red ST5 tone for sent-back steps. |
| S-449 | ✓ | 1.5px connector, green under done steps. |
| S-450 | ✓ | Already matched. |
| S-451 | ✓ | "What's this?" from 640px opens StepAboutPanel. |
| S-452 | ✓ | Done date, "With <holder> · n days", Due date or typical time. |
| S-453 | ✓ | Lead face and name on the live row from 768px. |
| S-454 | ✓ | 104px status chip; empty slot on upcoming rows. |
| S-455 | ✓ | Rounded live tint inside the card padding. |
| S-456 | ◐ | Summary row with "Open registrations" added; the grouped step list stays (leads open registration steps there). |
| S-457 | ◐ | Board resolution link kept (real only). |
| S-458 | ✓ | StepAboutPanel (420px, step card, points, MCA rule, Assist profile tags, follow-up for Ask users). |
| S-459 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-460 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-461 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-462 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-463 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-464 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-465 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-466 | ◐ | Embedded compliance views are the compliance agent's; unchanged. |
| S-467 | ✓ | Documents card: group "All", file badge, name, source · date · size, download. |
| S-468 | ✓ | Documents card: group "All", file badge, name, source · date · size, download. |
| S-469 | ✓ | Already matched. |
| S-470 | ◐ | Notes panel kept with its real actions (pin, edit, delete). |
| S-471 | ◐ | Notes panel kept with its real actions (pin, edit, delete). |
| S-472 | ◐ | Notes panel kept with its real actions (pin, edit, delete). |
| S-473 | ◐ | Notes panel kept with its real actions (pin, edit, delete). |
| S-474 | ◐ | Hex loader before the engagement resolves kept. |
| S-475 | ◐ | Unknown-client states unchanged. |
| S-476 | ◐ | Unknown-client states unchanged. |
| S-477 | ✓ | Already matched. |
| S-478 | ✓ | 20px between head, tabs and cards on both records. |
| S-479 | ◐ | Legacy route kept for deep links. |
| S-480 | ✓ | "Submitted" chip uses positive tokens; other emerald/amber/slate literals in my files replaced. |
| S-481 | ✓ | Already matched. |
| S-482 | ✓ | Already matched. |
| S-483 | ✓ | Already matched. |
| S-484 | ✓ | Already matched. |
| S-485 | ◐ | Meta keeps the full phase title and the staff days line. |
| S-486 | ✓ | Status chip shows for every staff reader (not on direct-flow steps). |
| S-487 | ✓ | Outline "What's this?" opens StepAboutPanel on staff routes. |
| S-488 | ◐ | Phone doc pack button kept. |
| S-489 | ✓ | StepWindowBar on every staff step. |
| S-490 | ✓ | "Edit the window" dialog for managers/admins; Part A/B steps edit the incorporation window. |
| S-491 | ✓ | "Edit the window" dialog for managers/admins; Part A/B steps edit the incorporation window. |
| S-492 | ◐ | Doc pack link only where a pack exists (SPICe+ Part A and B). |
| S-493 | ◐ | Copy for Assist kept as a box on Assist steps. |
| S-494 | ◐ | Form sections kept; no Forms/Activity switch or Filed/To file heads. |
| S-495 | ◐ | Form sections kept; no Forms/Activity switch or Filed/To file heads. |
| S-496 | ✓ | 20px ST5 mark per field from `step_field_states` (accepted done, asked teal, review amber, sent back red, not asked dashed): `FieldReviewMark` in `milestone-form/field-review.tsx`. |
| S-497 | ✓ | 104px chip per field: "Asked · 3d", "Review", "Accepted", "Sent back". A client save turns asked fields into "answered" (`step-field-answers.ts`, called from `updateChecklistState`). |
| S-498 | ◐ | Real form behaviour kept. |
| S-499 | ✓ | "Send reminder" on an asked field posts one staff message on the client thread (`client_messages.item_key = step:<engagement>:<item>`), writes an audit event and shows a toast. |
| S-500 | ◐ | Real form behaviour kept. |
| S-501 | ◐ | Real form behaviour kept. |
| S-502 | ◐ | Real form behaviour kept. |
| S-503 | ◐ | Real form behaviour kept. |
| S-504 | ◐ | Real form behaviour kept. |
| S-505 | ◐ | Real form behaviour kept. |
| S-506 | ✓ | Rail is a section card with icon tile and "x of y". |
| S-507 | ✓ | Already matched. |
| S-508 | ✓ | Step code in the rail (`showStepCode`). |
| S-509 | ✓ | Already matched. |
| S-510 | ◐ | Role badge and rail extras kept. |
| S-511 | ◐ | Role badge and rail extras kept. |
| S-512 | ✓ | Rail stacks under the main card below lg. |
| S-513 | ◐ | Doc pack rail card restyled in round one; title stays pre-incorporation (the pack only holds Part A/B). |
| S-514 | ◐ | Doc pack rail card restyled in round one; title stays pre-incorporation (the pack only holds Part A/B). |
| S-515 | ◐ | Doc pack rail card restyled in round one; title stays pre-incorporation (the pack only holds Part A/B). |
| S-516 | ◐ | File requests panel kept (real only). |
| S-517 | ✓ | `lg:grid-cols-[minmax(0,1fr)_300px]`, 16px gap. |
| S-518 | ✓ | Grey shapes while loading. |
| S-519 | ✓ | "Step" card with a dashed "No step" area. |
| S-520 | ✓ | Already matched. |
| S-521 | ◐ | Registration and obligation records are the compliance agent's views. |
| S-522 | ◐ | Registration and obligation records are the compliance agent's views. |
| S-523 | ◐ | Registration and obligation records are the compliance agent's views. |
| S-524 | ◐ | Registration and obligation records are the compliance agent's views. |
| S-525 | ✓ | Already matched. |
| S-526 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-527 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-528 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-529 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-530 | ◐ | Disabled at 0 ready kept (a zip of nothing fails). |
| S-531 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-532 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-533 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-534 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-535 | ◐ | Column widths per round one. |
| S-536 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-537 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-538 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-539 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-540 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-541 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-542 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-543 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-544 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-545 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-546 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-547 | ◐ | Real Word render on a grey band. |
| S-548 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-549 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-550 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-551 | ✓ | Done in round one (DocPackView, DocPackRow, DocStatusChip, DocPackPreviewPanel); checked and kept. |
| S-552 | ◐ | Real empty, error and not-found states kept. |
| S-553 | ✓ | Already matched. |
| S-554 | ✓ | Already matched. |
| S-555 | ✓ | Already matched. |
| S-556 | ✗ | No manager/admin editor route: the board-resolution API admits the lead flow only; needs a route and permission review. |
| S-557 | ✗ | No manager/admin editor route: the board-resolution API admits the lead flow only; needs a route and permission review. |
| S-558 | ✓ | Two columns from lg with a 300px Stage rail; no outer card. |
| S-559 | ✓ | 44px client tile in the identity colour. |
| S-560 | ✓ | Meta "Company · Pre-2". |
| S-561 | ✓ | Stage chip always: Draft, With manager, Finalized, Signed. |
| S-562 | ◐ | Toolbar, save state and preview parts are board-resolution components with real behaviour; not changed this round. |
| S-563 | ◐ | Toolbar, save state and preview parts are board-resolution components with real behaviour; not changed this round. |
| S-564 | ◐ | Toolbar, save state and preview parts are board-resolution components with real behaviour; not changed this round. |
| S-565 | ◐ | Toolbar, save state and preview parts are board-resolution components with real behaviour; not changed this round. |
| S-566 | ◐ | Toolbar, save state and preview parts are board-resolution components with real behaviour; not changed this round. |
| S-567 | ◐ | Toolbar, save state and preview parts are board-resolution components with real behaviour; not changed this round. |
| S-568 | ✓ | Helper sentence removed (repair case keeps one line). |
| S-569 | ◐ | Toolbar, save state and preview parts are board-resolution components with real behaviour; not changed this round. |
| S-570 | ✓ | Stage list with 20px ST5 marks and connectors. |
| S-571 | ◐ | Lead still sends for manager approval (real permission). |
| S-572 | ◐ | Modal kept; title and text shortened to one line; default blurple action. |
| S-573 | ✓ | After finalize the Stage rail shows "Next: send to client" and "Send to client": it opens a mail to the client and records `sent_to_client_at` (`POST /api/engagements/:id/board-resolution/sent`); then "Sent to client 29 Oct" and "Send again". |
| S-574 | ◐ | Staff upload of a signed copy needs an API (no route today). |
| S-575 | ✓ | Already matched. |
| S-576 | ◐ | Real banners and loader kept. |
| S-577 | ◐ | Real banners and loader kept. |
| S-578 | ◐ | Real banners and loader kept. |
| S-579 | ✓ | Rail goes under the preview below lg. |
| S-580 | ✓ | Already matched. |

## Files changed (round 2, on top of round one's work in the same area)

- src/components/timeline/RecordTimelineCard.tsx: label a11y fix. API of `@/components/timeline` unchanged: `GanttTimeline`, `RecordTimelineCard`, `buildRecordTimeline`, `axisFraction`, `shortDate` and the types.
- src/components/incorporation/ChecklistPhaseStepRow.tsx: rewritten to the prototype StepList row (connector, dates, holder, lead face, chip, What's this?, red sent-back).
- src/components/incorporation/RecordPhaseTrack.tsx: range text, faint partial bar.
- src/components/incorporation/InternOverviewProgress.tsx: `headMeta`, `range`.
- src/components/incorporation/InternEngagementOverview.tsx (+ module.css): identity tile, `meta`, `actions`, 20px spacing.
- src/components/incorporation/TimelineRequestsPanel.tsx, WorkItemsPanel.tsx: section card heads.
- src/components/incorporation/ClientFileRequestsPanel.tsx, src/views/incorporation/MilestoneResponseRowSummary.tsx, MilestoneResponseFormViewFooters.tsx, milestone-form/editable-field.tsx: raw palette colours to tokens.
- src/views/client-record/RecordStepsCard.tsx (new), RecordHeadParts.tsx (new), RecordDocuments.tsx (new), RecordTabs.tsx (Documents tab).
- src/views/admin/ProjectDetail.tsx, src/views/admin/EngagementDetail.tsx: both records use the shared head parts, Timeline card and Steps card.
- src/views/engagement/EngagementStepDetail.tsx: direct-flow guard restored on the head chip.
- src/views/intern/Clients.tsx, src/views/admin/Projects.tsx, ProjectsSections.tsx, FirmProjectsPanel.tsx: client row facts, filters, legend, phone cards, assign.
- src/views/intern/BoardResolutionEditorView.tsx, BoardResolutionEditorDocPanel.tsx: head, stage chip, Stage rail, shorter confirm.

## Round 3 (migration 0028)

- `src/db/repositories/step-field-states.ts` (new): `listStepFieldStates`, `applyStepFieldAction` (ask, remind, answered, approve, send_back, clear). AuthContext and `assertEngagementAccess`; a developer is refused, a client reads its own engagement and never writes. Every write uses the approved id and writes an audit event.
- `src/db/repositories/step-field-answers.ts` (new): a client's save turns fields staff asked for into "answered". It is best effort and never blocks the save. `engagements/write.ts` calls it.
- `src/db/repositories/board-resolution.ts`: `markBoardResolutionSentToClient` (staff only, finalized only, scoped by `getEngagementById`); `mapRow` returns `sentToClientAt`/`sentToClientBy`. `BoardResolutionDoc` type has the two fields.
- `src/lib/steps/field-states.ts` (new): types and the chip/mark words.
- UI: `src/views/incorporation/milestone-form/field-review.tsx` (new), wired into `editable-field.tsx` and `read-only-field.tsx`; `BoardResolutionEditorView.tsx` "Send to client".
- Tests: `step-field-states.test.ts` (18, cross-tenant: other engagement 403 with no query or write for every role, client and developer cannot write, the delete is scoped to the approved id), `board-resolution-sent.test.ts` (7, cross-tenant and finalized-only). `MilestoneResponseForm.errors.test.tsx` stubs the new review parts, the same way it stubs the Ask buttons.

## New routes
- `GET/POST /api/engagements/:id/field-states` (GET: staff and the engagement's client; POST: staff).
- `POST /api/engagements/:id/board-resolution/sent` (staff).
None.

## Schema needs
- Met by migration 0028 (`step_field_states`, `engagement_board_resolutions.sent_to_client_at/_by`). Nothing further.

## Requests for shared files
- `src/components/ui/step-track.tsx` PhaseBar: a `stuck` prop (red current bar) and an optional `hrefFor(i)` so bars link to `?phase=n` (S-281, S-282).
- `src/components/ui/avatar-stack.tsx`: hashed face palette (S-285).
- `src/components/dash/EFilingGrid.tsx`: footer "1–14 of N", chevron pager with "…", skeleton on view switch (S-296, S-299, S-302, S-304).
- Shell: manager and admin "Clients" sidebar item with count and fold; phone tab "Clients" (S-269 to S-271).

## Decisions
- Any staff member with access to the engagement may ask, remind, accept or send back a field (the lead reviews client answers on the step page); a client never writes field states.
- "Send reminder" keeps the original ask date, so "Asked · 3d" keeps counting.
- The lead and the manager/admin record keep their two routes but render the same shared parts.
- "Edit the timeline" writes only what is stored (the incorporation window and the expected COI); the separate head controls were removed from ProjectDetail because the dialog does the same writes.
- The registrations phase keeps its full step list under the new "Open registrations" summary row, so leads can still open registration steps.
- Client stage on lists is Incorporating until `isIncorporated`, then Compliance; the record head keeps the stored stage word.
- Admin list: Assign and Reassign move clients between managers; firm-wide admins only.
