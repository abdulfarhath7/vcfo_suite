# fix-client-compliance (round 2): Calendar, Filings, Obligations, Obligation, Registrations, Registration (C-258 to C-508)

Checks: `npx tsc --noEmit -p .` is clean for every file in this area (errors left are in other areas: views/compliances, shell/RoleSidebar, views/intern/MyWork, client-portal/pages/home/TimelineEditor, team/AnnouncementsPage). `npx eslint` on pages/compliances and pages/registrations: 0 errors, 30 warnings (existing patterns). `npx vitest run src/components/client-portal src/lib/client-portal`: 45 passed. `node scripts/cp-css.mjs` regenerated.

Rows marked ✓ in PROTOTYPE-DIFF are not repeated. "Stays" means the real tool keeps its behaviour on purpose (R-13 words, a real feature, or real data).

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-258 | ✓ | Rail moves under the grid below 1024px (was 1180). |
| C-259 | ✓ | `.stag` entry motion removed from Calendar and Filings. |
| C-260 | ✓ | Calendar bar wraps below 1280px. |
| C-261 | ✓ | Month and year 13px weight 700. |
| C-263 | ✓ | Picked cell blurple with on-brand text, 1.5px edge, head buttons 700, Today link 600 blurple. |
| C-264 | ✓ | FY tag amber (warning-soft / warning), 32px, 12px. |
| C-265 | ✓ | `Seg` now uses SpectrumTabs size sm (22px). |
| C-267 | ✓ | 22px. The "Already showing" toast stays (real extra). |
| C-268 | ✓ | Secondary Button, 32px, semibold ink, FileText icon. |
| C-271 | ✓ | Weekday band 700. The band is surface-sunken, the same value as the prototype navy-tint (#f4f6fa). |
| C-273 | ✓ | Day number 700. |
| C-274 | ✓ | Today cell: soft blurple fill and a 2px blurple inner ring. |
| C-276 | ✓ | Tag edge uses the mid status colours (STROKE), 600. |
| C-278 | ✓ | A day with no filings is a plain grid cell, not a button. |
| C-280 | ✓ | Pop-over rebuilt: 340px, 1px edge, shadow-float, head band with hairline, no ✕, no arrow. Placement stays hand-made (no Radix in the client portal). |
| C-282 | ✓ | Full-width rows with hairlines: short area tag, name 13px, period 12px, ↗, Proof chip, status chip. |
| C-283 | stays | Ask VCFO link is a real feature. |
| C-284 | stays | R-13 (design authority) has six words; Filed/Upcoming are prototype sample words. |
| C-288 | stays | Empty-month card is the R-48 empty state with real actions. |
| C-289 | stays | Before incorporation there is no register data. |
| C-290 | ✓ | "Loading…" text replaced by a grey shape over the grid. |
| C-291 | stays | Real error state with Try again. |
| C-294 | ✓ | Donut centre 600; count-up and centre button stay. |
| C-295 | ✓ | Legend 12.5px 600; words per R-13. |
| C-296 | stays | Counts the month in view, which is the month the grid shows (decision). |
| C-297 | ✓ | Eyebrow 11px bold, orange square (`bg-highlight-bright`). |
| C-298 | ✓ | `rounded-lg`, 28px bold, DAYS bold, drills to Due soon. |
| C-299 | ✓ | 18px bold, tight tracking; (i) stays. |
| C-301 | ✓ | Remind me is outline; once set a green "Reminder set" chip replaces it. Undo toast stays. |
| C-302 | ✓ | Name and late words 600; "+n more" stays. |
| C-303 | stays | Real empty state (R-48). |
| C-304 | ✓ | Tile number 18px bold, count 11px, empty "None". |
| C-305 | ✓ | Rail two columns at 768 to 1023px, Coming up spans both; one column below 768px. |
| C-306 | ✓ | Year grid 1 / 2 (420px) / 3 (1024px) / 4 (1536px) columns. |
| C-307 | ✓ | Lined-table overrides removed: month cards, 20px rounded cells, 2px gap, mono 10.5px. |
| C-308 | ✓ | Days with filings: solid mid fill, light text. |
| C-309 | ✓ | Today 1.5px navy ring; this month 2px navy inner ring. |
| C-312 | stays | Whole FY is real and scrolls; decision. |
| C-313 | stays | Undo, slider, pinch zoom are real extras. |
| C-314 | ◐ | Not changed (column widths 110 to 150px). |
| C-315 | ✓ | No card shadow, filed at 70%, late bar has a 1px red ring. |
| C-316 | ✓ | Due mark is a 2x22px blurple bar, red when late. |
| C-317 | ✓ | Today line orange (highlight-bright), no label. |
| C-318 | stays | A filed bar opens its detail (more useful than a toast). |
| C-319 | ✓ | Stripe gradient removed. |
| C-320 | ✓ | CpModal 760px, eyebrow "Authority · Frequency", 15px title with ↗, chips under (overlay.tsx). |
| C-321 | ✓ | Area pill, status chip, early/late chip or "Due 20 Oct" (red when late). |
| C-322 | ✓ | 20px marks, no sunken cell. |
| C-323 | ✓ | Key and value list: Authority, Frequency, Period, Due, Filed on, Reference, Filed by, Penalty risk (+ Tax paid when stored). |
| C-324 | ✗ | no data: VCFO Assist run state per filing. |
| C-325 | ✓ | Proof section with file badge rows, Preview, Download; "Proof pending" chip. |
| C-326 | stays | Draft date banner is real data. |
| C-327 | ✓ | "Add to my calendar" outline, "Open in filings" primary; Ask VCFO link stays. |
| C-328 | stays | Shows the real proof file. |
| C-329 | ✓ | Drill rebuilt on CpModal 760px: eyebrow "As of …", 15px title, ✕. Top strip removed. |
| C-330 | ✓ | Segmented status tabs with counts, prototype order. |
| C-331 | ✓ | T1 grid (EFilingGrid): Filing, Period, Area, Due / filed, Status; 7 a page with page numbers. |
| C-332 | ✓ | Grid empty "None" (Ask VCFO why kept as the empty action). |
| C-333 | ✓ | One primary footer button ("Open filings", or "Show in the list" on Filings). |
| C-334 | stays | Separate phone page (week strip and agenda) is a real design; decision. |
| C-335 | stays | Phone number cards drill down (real extra). |
| C-336 | stays | See C-334. |
| C-337 | ◐ | Filings button added to the phone page; the Month/Year/Timeline switch stays desktop only. |
| C-338 | ✓ | Rail cards (donut, Next deadline, Coming up) stack under the phone agenda. |
| C-339 | stays | Bottom sheet on phones (CpModal). |
| C-340 | ✓ | Literal colours replaced with tokens (row hover, drag ring, focus ring, year hover). |
| C-341 | ✓ | Two equal cards (`md:grid-cols-2`, gap 20px), then the grid. |
| C-342 | ✓ | New `MonthChart.tsx`: "Filings by month", meta FY, 232px stacked columns Apr to Mar by status (R-25 fills), click a column to drill; screen-reader month buttons. |
| C-343 | ✓ | Donut removed from Filings (still on Calendar). |
| C-344 | ✓ | SCard "Progress by area" with 52px head and icon tile. |
| C-345 | ✓ | "GST · 3 of 5 filed", 6px bar, legend row per status with count. Areas with filings are shown. |
| C-346 | ✓ | Chart and area card count the whole FY. |
| C-347 | ✓ | Area bar opens the drill on status tabs. |
| C-348 | ✓ | Grid head has the icon tile and the count as plain muted text. |
| C-349 | ✓ | "Sep to Oct 2026". |
| C-350 | ✓ | All, Monthly, Quarterly, Annual with counts, 22px. Default is All. |
| C-351 | ◐ | Set chip shows "Area GST"; Labour has no data. |
| C-352 | stays | R-13 words. |
| C-353 | stays | FY stepper reaches every year on the register; decision. |
| C-356 | stays | EFilingGrid has no footer slot; request below. |
| C-357 | ✓ | 56px column; tile month "Oct" 11px (first round). Four tones: the register has no In progress state. |
| C-361 | ✓ | "Not filed yet" muted (days left in the title); filed date bold only when late. |
| C-362 | ✓ | 124px; words per R-13. |
| C-363 | ✗ | no data: VCFO Assist run state per filing. |
| C-364 | ✓ | Reference column (acknowledgementNo, mono 12.5px, "-"). |
| C-366 | ✓ | Late rows red text (rowClassName). |
| C-367 | ✓ | Row in the side panel has a soft blurple fill. |
| C-368 | ◐ | 10 rows a page. The "1–10 of 34" count needs EFilingGrid (foundations); request below. |
| C-370 | stays | Empty text with Ask VCFO why is a real extra. |
| C-371 | stays | Skeleton rows; chart row waits for data. |
| C-372 | stays | No data before incorporation. |
| C-373 | ✓ | CpSidePanel: full height, 520px, 1px left edge, eyebrow "Area · Frequency", 15px title, chips under. |
| C-374 | ✓ | Same chips as C-321. |
| C-375 | ✓ | 20px marks. |
| C-376 | ✓ | Key and value list (C-323). |
| C-377 | ✗ | no data: VCFO Assist run state per filing. |
| C-378 | ✓ | "PROOF" capitals head, first row fill; "Add proof" stays (real G-03). |
| C-379 | ✓ | "Open obligation" primary; Ask, Add to calendar, Remind me stay. |
| C-381 | ✓ | `stickyFirstColumn`. |
| C-382 | ✓ | Panel takes the full width on phones. |
| C-385 | ✓ | 360px rail, gap 20px, rail one column. |
| C-386 | ✓ | SCard meta is plain muted text, hidden on phones (first round). |
| C-387 | ✓ | HeadSearch 160px, hidden below 640px, "/" focuses it (first round). |
| C-388 | ✓ | 22px; "By frequency", "By law". |
| C-390 | stays | Real register has One-time and Other. |
| C-391 | stays | no data: Labour area. |
| C-392 | ✓ | Tiles in a grid (1 / 2 from 640px / 3 from 1536px): name with chevron, area pill and status chip, "Due 20 Oct" (red when late) or "Filed 18 Oct", plus "n of m filed". |
| C-393 | stays | R-13 words. |
| C-395 | ✗ | no data: obligations before the certificate. |
| C-396 | stays | Skeleton rows. |
| C-397 | ◐ | Count removed. Teal Calendar icon needs `cardHeadIcon` to know "due"; request below. |
| C-398 | ✓ | Blurple tile for 8 to 15 days (`urgencyTint`). |
| C-399 | ✓ | Title 600; sub "In 3 days · GST" with red or amber words (`DueWords`). |
| C-401 | ✓ | Late row shows a small navy "Fix". |
| C-402 | ✓ | Outline "Approve" or "Upload"; the sub keeps the client's step and period. |
| C-403 | ◐ | Track removed; the legend filter is a real extra; words R-13. |
| C-405 | ✓ | Tiles one column, search hidden on phones. |
| C-408 | ◐ | no data: the registration that starts an obligation. |
| C-410 | ✓ | "Next due 20 Oct" (red when late) or "Filed 18 Oct", "Steps n of 4"; "Filed n of m" stays. |
| C-411 | ✗ | no data: people on the obligation in the client payload (only the SBC owner name). |
| C-412 | ◐ | Filed: "Download acknowledgement". Open: Remind me and Add to calendar stay (no document requests per obligation). |
| C-413 | ✓ | 360px rail, 20px gap. |
| C-414 | ✓ | Meta long month; vertical StepList with the line, live step tinted with "With … · note", done dates from the register. "Open details" stays. |
| C-415 | ✗ | no data: document requests and client-filled fields per obligation. |
| C-416 | ✗ | Same as C-415. |
| C-417 | ✗ | no data: SBC-filled fields per obligation. |
| C-418 | ✓ | "Past periods": Period, Filed on, Reference, Status (+ Proof), 6 a page, past periods only. |
| C-420 | ✓ | About shows the about text, the facts, "Read the SBC SOP" and Ask VCFO. |
| C-421 | ✓ | About text sits in the About card. |
| C-424 | ✓ | Separate "Due rule" card. |
| C-425 | ✓ | "Read the SBC SOP" links to the library. |
| C-426 | ✗ | no data: obligations before the certificate. |
| C-427 | stays | In-portal "Not on your register" card; decision. |
| C-428 | stays | Skeleton rows. |
| C-433 | ✓ | 360px rail, gap 20px. |
| C-434 | ✓ | Rail one column. |
| C-436 | ✓ | SCard pads 20px from 768px (first round). |
| C-438 | ✓ | Plain muted count, hidden on phones. |
| C-439 | ✓ | 160px, hidden below 640px. |
| C-440 | ✓ | "/" focuses the search. |
| C-442 | stays | Wider search (real extra). |
| C-443 | ◐ | 22px. "By group" stays: the real groups are not regulators. |
| C-444 | stays | R-13 set with Overdue and Done. |
| C-445 | stays | Real groups. |
| C-447 | ✓ | Tile cards (`RegTileCard`), 1.5px line, 6px corners, 14x12px padding. |
| C-448 | ✓ | 1 / 2 from 640px / 3 from 1536px. |
| C-449 | ✓ | No date tile on the item. |
| C-450 | ✓ | Chevron next to the name. |
| C-451 | stays | WordPill keeps the real area words (AreaPill takes regulators only). |
| C-452 | ✓ | `REG_TONE`: Not started grey. |
| C-453 | ✓ | Owner chip off the item. |
| C-454 | ✓ | Date line "Due 20 Oct" / "Done 12 Oct" / first need / "Not needed", red when late. |
| C-455 | stays | Stored number is real data. |
| C-457 | ✓ | 60% opacity. |
| C-458 | stays | R-48 dashed empty state. |
| C-459 | stays | Real empty state. |
| C-460 | stays | Real extra. |
| C-461 | stays | Real error line. |
| C-462 | stays | Skeleton rows. |
| C-463 | ◐ | Request: `cardHeadIcon` should map "due" to Calendar on teal. |
| C-464 | ✓ | No count. |
| C-465 | ✓ | Urgency tile, title 600, sub the first need, relative chip. |
| C-466 | ✓ | "After the certificate" before the certificate. |
| C-467 | stays | Renewals is a real extra. |
| C-469 | ✓ | Count removed; sub the needs. |
| C-470 | ✓ | Outline "Upload"; it opens the incorporation step page where uploads happen. |
| C-473 | ◐ | No track; R-13 segments stay. |
| C-474 | stays | Legend filter is a real extra. |
| C-475 | stays | Live checklist state. |
| C-478 | stays | no data: authority and team per registration. |
| C-479 | ✓ | Owner chip removed; Not started grey; WordPill stays (C-451). |
| C-480 | stays | Due/Done and Renew by are real. |
| C-481 | ✗ | no data: people per registration. |
| C-482 | ◐ | Not-needed hides actions; no Working/Done state. |
| C-483 | ✓ | 360px rail, 20px gaps. |
| C-484 | ✓ | Meta plain text. |
| C-486 | ✓ | StepList draws the connector line, green under done steps. |
| C-487 | ◐ | Live step shows "Thu · Today"; no data: done date per step part. |
| C-488 | ✓ | "With <company>" teal or "With SBC/MCA" blurple with " · due …". no data: who did done parts. |
| C-490 | stays | The step parts are the registration's steps in the real model. |
| C-491 | ✗ | no data: document status per registration. |
| C-492 | ✗ | no data: client-filled registration fields. |
| C-493 | ✗ | No upload target per registration (same as C-491). |
| C-494 | ✗ | Follows C-493. |
| C-495 | ✓ | Card renamed "Filled by SBC", meta "Read only". |
| C-496 | ✓ | Icon follows the new title. |
| C-497 | ✓ | "-" in faint; "Loading" and "Could not load" stay for those states. |
| C-498 | ◐ | SOP link added; no data: about paragraph per registration (facts stay). |
| C-499 | ✓ | "Read the SBC SOP". |
| C-500 | ✗ | no data: applicability reason and rule. |
| C-501 | ✓ | Hidden when empty after the certificate. |
| C-502 | ✓ | "None" when no expiry. |
| C-503 | ✓ | Not-needed record hides Open step and Credentials. |
| C-504 | ✓ | Due shows "After the certificate" before the certificate. |
| C-505 | stays | In-portal card; decision. |
| C-506 | stays | Skeleton rows. |

## Files changed

- src/components/client-portal/pages/compliances/spectrum.tsx: `portalHref('knowledge-bank')` fix (typecheck); FilterMenu set chip shows the label; StackedBar has no track.
- src/components/client-portal/pages/compliances/CompDrill.tsx: rebuilt on CpModal + EFilingGrid + SpectrumTabs.
- src/components/client-portal/pages/compliances/MonthChart.tsx: new, "Filings by month".
- src/components/client-portal/pages/compliances/FilingsPage.tsx: chart and area card, All frequency with counts, Reference column, late and picked rows, 10 a page, sticky first column, head icon tile.
- src/components/client-portal/pages/compliances/cells.tsx: "Not filed yet".
- src/components/client-portal/pages/compliances/CalendarPage.tsx: Filings button, loading shape, empty days, tag colours, new day pop-over, rail tweaks, `Rail` exported.
- src/components/client-portal/pages/compliances/CalendarMobile.tsx: rail cards and Filings button on phones.
- src/components/client-portal/pages/compliances/DonutCard.tsx, YearView.tsx, TimelineView.tsx, bits.tsx (Seg size sm), ctx.tsx (comment).
- src/components/client-portal/pages/compliances/ObligationsPage.tsx, ObligationPage.tsx.
- src/components/client-portal/pages/compliances/Detail.tsx and overlay.tsx: first-round work kept as is (complete).
- src/components/client-portal/pages/registrations/RegistrationsPage.tsx, RegistrationPage.tsx, parts.tsx.
- src/components/client-portal/css-src/compliances-board.css (+ regenerated css/).

## New routes

None.

## Schema needs

None asked for here; the ✗ rows need new stores (VCFO Assist run state per filing; document requests and client fields per obligation and per registration; SBC-filled fields per obligation; people per obligation and registration in the client payload; applicability reason per registration).

## Requests for shared files

- Foundations, `src/lib/ui/card-head-icon.ts`: map titles with "due" ("Due in the next 15 days") to the Calendar icon on teal (C-397, C-463).
- Foundations, `src/components/dash/EFilingGrid.tsx`: a footer with "1–10 of 34" at the left and the page buttons at the right, and a footer slot for "Clear filters" (C-356, C-368).

## Decisions

- Status words stay the R-13 set (Done, Due soon, Overdue, Not started) everywhere; the prototype screens use sample words.
- The phone calendar keeps its own page; it now also shows the rail cards and the Filings button.
- Drill footer label comes from the caller: "Open filings" (calendar, obligations, obligation) or "Show in the list" (Filings).
- Filings opens on frequency All by default (`?cadence=` absent), so the old "first cadence with filings" logic is gone.
- The Obligation "Past periods" grid lists filed or past-due periods only; the open period is in This period and the rest are in Filings.
