# fix-client-docs (round 2): client Credentials, Documents, Doc viewer, Library, Announcements, Notifications, Audit, Profile, Settings, Team

Progress log (written as each screen finishes).

## Profile and Settings (C-813 to C-875)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-813 | ✓ | `/app/client/profile` added (same entry as `/app/client/settings`); both render the Profile page. `/app/client/team` stays its own page (real route kept). |
| C-814 | ✓ | 220 px left section menu, sticky from 768 px, 36 px avatar (photo or blurple soft initials), name and "Primary · company". |
| C-815 | ✓ | About you, Sign-in and security, Notifications, Appearance, Company, Team, Settings. |
| C-816 | ✓ | 34 px menu buttons; picked = brand-soft fill, brand text, 500. |
| C-818 | ✓ | `?tab=profile|security|notify|look|company|team|settings`; old hashes still open (`#notifications` → Settings matrix, `#appearance` → Appearance, `#team`, `#security`). |
| C-819 | ✓ | About you is a FormRow card (label and hint left, 464 px control column). |
| C-820 | ✓ | Name and Mobile save on blur; green "Saved" chip for 1.5 s in the card head. |
| C-821 | ✗ | no data: no designation column for a client person. Schema need below. |
| C-822 | ✓ | "Mobile" input, hint "For sign-in codes and WhatsApp". |
| C-823 | ✓ | Email reads as text, hint "Your sign-in address"; a ghost "Change" opens the real email change with the current password (feature kept). |
| C-824 | ✓ | "Change photo" button row (and "Remove photo" when a photo is set). |
| C-825 | ✓ | "Password", hint "Last changed 12 Sep 2026" (real date), "Change password". |
| C-826 | ✓ | Real two-step sign-in (`/api/account/two-step`, TOTP) through the shared `TwoStepRows`; on/off chip and Turn on/Turn off. |
| C-827 | ✓ | Real devices list from `/api/account/sessions` (shared `DevicesRows`). |
| C-828 | ✓ | "Sign out others" (real `/api/account/sessions/revoke-others`). |
| C-829 | ✓ | Three 30 px checkbox chips: In-app and Email locked on, WhatsApp opens the opt-in dialog or turns it off with Undo. |
| C-830 | ✓ | Quiet hours: switch plus start and end time fields (real `quietStart`/`quietEnd`), hint shows the window. |
| C-831 | ✗ | no data: reminder lead time per client. Schema need below. |
| C-832 | ✗ | Text size needs a shell-level setting (the portal CSS is in px); request below. |
| C-833 | ◐ | Company section built: company name, people who can sign in (real team), Invite (opens Team, Primary only), "Ask for a change" (opens Messages). Employees, State, Exports left out: no client-readable questionnaire path. |
| C-834 | ✓ | Settings section: from 1280 px a 400 px left column (head, Profile, Security) and a fluid right column (Notifications, Appearance). |
| C-835 | ✓ | Profile head is its own plain card, 16/20 px padding. |
| C-836 | ✓ | 72 px circle, brand-soft fill, brand initials 22 px (photo when set). |
| C-837 | ✓ | 28 px camera button, 1.5 px edge, control shadow, opens the file picker (Remove photo lives in About you). |
| C-838 | ✓ | 22 px, 500. |
| C-839 | ✓ | `Tag` Primary (prog) or Member and `Tag` company name. |
| C-840 | ✓ | SCard head with the shared CardHeadTile; ghost Edit. |
| C-841 | ✓ | 44 px fact rows, 92 px key, 13 px 500 muted. |
| C-843 | ✓ | Inputs replace Full name and Phone in place; ghost Cancel and primary Save in the head; Undo toast. |
| C-844 | ✓ | "Security" with the shared head tile. |
| C-846 | ✓ | White box, 1.5 px line, 16 px padding. |
| C-847 | ✓ | Four 5 px bars: positive, positive-mid, warning-mid, danger-mid. |
| C-848 | ✓ | Four text checks with tick or cross and the verdict word at the right. |
| C-849 | ✓ | Green edge on match; "Passwords do not match" as you type. |
| C-850 | ✓ | Save password disabled until valid. |
| C-851 | ✗ | no data: sign-in city. Device name and "Active now" kept. |
| C-853 | ✓ | Two cells in one band split by a hairline, no tiles. |
| C-854 | ✓ | "Always on" idle tag. |
| C-858 | ✓ | Timeline and Announcements blurple, Official feed teal; the rest unchanged. |
| C-863 | ✓ | Each switch shows "<row> · email on" with Undo (Undo writes back through the API). |
| C-864 | ✓ | Matrix is a table, 360 px min width, scrolls sideways. |
| C-865 | ✓ | 420 px, title "Turn on WhatsApp", step track in the sub line. |
| C-866 | ◐ | 18 px marks with "›"; steps are Number › Done because the code step is not live. |
| C-867 | ◐ | 64 px +91 box on the sunken fill, "Turn on". The consent box stays unticked (WhatsApp opt-in must be an active choice). |
| C-868 | ✗ | no data: no approved WhatsApp verification template. |
| C-869 | ✓ | Done step: green tick tile, "WhatsApp is on", the number, Done. |
| C-870 | ✓ | Shared head tile. |
| C-871 | ✓ | 13 px 500 muted sentence-case labels. |
| C-872 | ✓ | SpectrumTabs Light / Dark / System; toast "Theme · Dark" with Undo; saves to the account and local storage. |
| C-874 | ✓ | Switch with an Undo toast. |

## Team (C-876 to C-907)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-876 | ◐ | Team is a Profile section; `/app/client/team` still serves the same section as its own page (sidebar link kept). |
| C-880 | ✓ | Soft token tint with coloured initials (`avatarTint`); support and self use the blurple soft tint. Fixed the broken `avatarColor` import (tsc error). |
| C-886 | ✓ | Small primary "Invite", no icon. |
| C-887 | ✓ | 24 px avatar, name 500, "you" 12 px muted. |
| C-888 | ✗ | no data: role of a client person. |
| C-890 | ✓ | Since column 110 px, "2 Sep 2026", 12.5 px muted. |
| C-893 | ✓ | "1–N of N" footer under the table. |
| C-894 | ✓ | Faint centred "No people" / "No pending invites". |
| C-895 | ✓ | Phones keep every column; the name column sticks and the table scrolls sideways. |
| C-896 | ✓ | 420 px, title and close only. |
| C-897 | ✓ | Name and Work email stacked with placeholders. |
| C-898 | ✗ | no data: role of a client person. |
| C-899 | ✗ | no data: set-password link; the temporary password stays (DECISIONS). |
| C-901 | ✓ | "Send invite" without icon, disabled until name and email are valid. |
| C-902 | ✓ | One sunken box: from avatar and "Primary · company", "›", to avatar and "New Primary". |
| C-903 | ◐ | The red "You lose access" note stays as a real safety line. |
| C-904 | ✓ | Tick in both cases ("I understand I will be signed out" / "I understand <name> loses access"). |
| C-905 | ✓ | Primary for both buttons. |
| C-906 | ◐ | Undo on invite and cancel. Substitute and hand-off cannot be undone: the server creates the new account and removes the old seat at once. |
| C-907 | ✓ | Avatars use token tints that flip with the theme. |

## Announcements (C-708 to C-743)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-708 | ✓ | Main column plus a 360 px rail from 1024 px; stacks below. |
| C-710 | ✓ | Team card heads get 20 px side padding from 768 px. |
| C-711 | ✓ | LayoutGrid on the blurple tile. |
| C-712 | ✓ | Seg: 1.5 px edge, 3 px padding, 22 px buttons (round 1). |
| C-714 | ◐ | Extra real row (next deadline from the compliance runway) kept. |
| C-716 | ✓ | 44 px tile with a 1.5 px edge; deadline warning-soft; others white with ink text. |
| C-717 | ✓ | Upper case, muted, .06em; 11 px (the 11 px text floor). |
| C-718 | ✓ | Tooltip with the full date ("Thu 8 Oct 2026"). |
| C-725 | ✓ | "None" and "See all" on every tab. |
| C-726 | ✓ | Grey rows for 300 ms on each tab switch (`useTabFlash`), and on first load. |
| C-727 | ✓ | Landmark icon on the blurple tile. |
| C-729 | ✓ | 11.5 px caps. |
| C-730 | ✓ | Name on one line, truncated, full name in the tooltip. |
| C-732 | ✓ | Every row shows; the cap and "Show all" are gone. |
| C-733 | ✓ | Centred on desktop; bottom sheet on phones. |
| C-734 | ✓ | Title 15 px first; sub line: kind tag (soft, no dot), red Important, time. No date tile. |
| C-736 | ✓ | 36 px soft tint avatar. |
| C-738 | ◐ | Extra "Ask VCFO about this" link kept (real feature). |
| C-739 | ✓ | Disabled at the first and the last item; arrow keys stop at the ends. |
| C-741 | ✗ | no data: announcements store no in-app page link. |
| C-743 | ✓ | Token avatar tints. |

## Notifications (C-745 to C-778)

Round 1 built most of this page (272 px rail, md switch, 30 px tiles, tones, side panel, drill 760 px). Round 2 checked each row.

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-745 | ✓ | 272 px rail from 1024 px (round 1). |
| C-747 | ✓ | md switch with the edged track (round 1). |
| C-748 | ◐ | Extra real "Mark all read" with Undo kept. |
| C-751 | ✓ | 30 px tile, 16 px icon. |
| C-752 | ✓ | Documents, Sent back, Team blurple. |
| C-755 | ◐ | Body · one link per type; notifications store no structured parts to link one by one. |
| C-756 | ✓ | Chip hidden below 640 px. |
| C-757 | ✓ | Email prog, Announcement warn, Team prog. |
| C-759 | ✗ | no data: notifications store no actor. |
| C-763 | ✓ | The arrow and title open the side panel. |
| C-764 | ✓ | 440 px side panel: eyebrow, title, type tag, From / When / Area, body, Linked step card, main button. |
| C-765 | ✓ | "See all" on every tab. |
| C-766 | ✓ | Grey rows for 300 ms on each tab switch. |
| C-767 | ✓ | LayoutGrid blurple tile. |
| C-769 | ✓ | Parts with 2 px corners; no grey track when the month is empty. |
| C-770 | ✓ | No swatch. |
| C-771 | ✓ | LayoutGrid blurple tile. |
| C-773 | ✓ | 13 px, 500, blurple, underline on hover. |
| C-774 | ✓ | 760 px, centred; sheet on phones. |
| C-775 | ✓ | "This month", "N notifications", tabs in the head from 768 px. |
| C-777 | ✓ | Title one line (ellipsis), no chevron. |
| C-778 | ✓ | Closes the drill and opens the side panel. |

## Audit (C-783 to C-812)

Round 1 rebuilt the page as the prototype grid card (selects in the head, Result column from `audit_events.result`, side panel with the Before and After change, ten rows a page, sticky head, sideways phone scroll). Round 2 checked each row and finished two.

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-783 | ✓ | Clock on the violet tile. |
| C-784 | ✓ | "N events" after filters. |
| C-785 | ✓ | 150 px, 30 px, search icon, 1.5 px edge. |
| C-786 | ✓ | "All areas" select with counts in the head. |
| C-787 | ✗ | no data: the client audit feed has no sign-in events. |
| C-788 | ✓ | Who select: Everyone, SBC, company. |
| C-790 | ✓ | 10 px cell padding; the head sticks under the top bar. |
| C-791 | ✓ | Blurple "8 Oct 14:20" button for every row in the summary days ("Today" removed). |
| C-792 | ✓ | Action 500 and target 12.5 px muted, no node tile. |
| C-794 | ✓ | 150 px, name and role line. |
| C-795 | ✓ | Result chip from `audit_events.result` (round 1). |
| C-796 | ✓ | Row click opens the details; no chevron column. |
| C-797 | ✓ | 440 px side panel with eyebrow, title, area and result, Target and By, Details, CTA. |
| C-798 | ✓ | Change block: Before struck through, arrow, After on brand-soft. |
| C-799 | ✓ | Brand-soft fill on the picked row. |
| C-801 | ✓ | Ten rows a page, "1–10 of N", page numbers; "Load older" stays for older events. |
| C-803 | ✓ | Faint centred line ("No events match these filters" / "No events"); Clear filters kept beside it. |
| C-804 | ✓ | Grey shapes per column. |
| C-805 | ✓ | 760 px centred; sheet on phones. |
| C-806 | ✓ | Long date title, "N events". |
| C-807 | ✓ | The seven most recent days with events. |
| C-808 | ✓ | 48 px time, action 500, "target · who", area pill hidden on phones. |
| C-809 | ✓ | Closes the dialog and opens the side panel. |
| C-810 | ◐ | Extra "Show in the Audit log" footer kept (real). |
| C-811 | ✓ | Every column stays; first column sticks; the table scrolls sideways. |
| C-812 | ✓ | No fixed avatar colours left on the page. |

## Credentials (C-509 to C-561)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-510 | ✓ | Stage switch: 1.5 px line track, 3 px padding, 28 px buttons, 13 px. |
| C-511 | ✓ | Access log is a 30 px small button. |
| C-512 | ◐ | The page-wide Preview / Edit stays (it grants every sheet with one code, a real feature); renamed "Preview all" / "Edit all" so the sheet card keeps the plain "Preview" / "Edit". |
| C-513 | ✓ | 2 columns, 3 from 640 px, 6 from 1280 px; the first tile 1.5fr; 12 px gap. |
| C-516 | ◐ | The extra hide button on a revealed tile stays (ends the reveal early, real). |
| C-517 | ✓ | The copy icon turns into a green tick for 1.5 s; no toast. |
| C-518 | ✓ | Registrations and DSC values in sans 14 px 500. |
| C-521 | ✓ | Count in a small pill, blurple soft on the picked tab. |
| C-522 | ✓ | The select replaces the tabs below 1024 px. |
| C-523 | ✓ | "Login credentials" (CRED_TABS). |
| C-524 | ◐ | Sheet buttons read "Preview" and "Edit"; Lock when open. Edits save cell by cell, so there is no Save button. |
| C-526 | ◐ | Extra title band (company and address) kept: real data. |
| C-529 | ◐ | The 520 px scroll box with sticky gutter and label column stays for long sheets. |
| C-530 | ◐ | Row Preview and Edit stay: row-scoped grants are a real feature of the OTP model. |
| C-531 | ◐ | Same: the row eye lives in the gutter. |
| C-532 | ◐ | The lock marker on secret columns stays (tells which columns need a code). |
| C-533 | ◐ | Lock icon button kept; the info button explains the reveal rule. |
| C-534 | ◐ | Hide button kept beside the chip and copy. |
| C-535 | ◐ | Not changed: the sheet column metadata does not mark identifier columns; needs a `mono` flag on the column definitions. |
| C-538 | ◐ | Extra amber "Edited" tag kept (real provenance). |
| C-539 | ✓ | "-" in faint. |
| C-541 | ◐ | Cell-by-cell editing with Undo stays (each save is audited per cell). |
| C-543 | ◐ | "Add row" under the grid stays; it asks for the Edit code. |
| C-544 | ◐ | Dashed empty box with the add action kept (R-48 empty state with the action). |
| C-545 | ✓ | 420 px, 52 px head, 15 px title; bottom sheet below 640 px. |
| C-546 | ✓ | Title "Preview the sheets" / "Edit Login credentials" / "Reveal <label>", no eyebrow. |
| C-548 | ✓ | Six full-width boxes, 44 px, 1 px line, mono 16 px. |
| C-550 | ✓ | "Too many wrong tries. Try again later." with the real countdown. |
| C-552 | ✓ | Muted "Open for 10 minutes" in the dialog (preview and edit). |
| C-553 | ◐ | Drawer kept with "Open in Audit" (real link); not moved to SidePanel. |
| C-555 | ◐ | Real loading, error and empty states kept. |
| C-556 | ◐ | Real loading shapes kept. |
| C-557 | ◐ | Real error box kept. |
| C-558 | ✓ | Icons at stroke 1.6. |
| C-561 | ✓ | Tiles 2 columns on phones (3 from 640 px); 40 px touch targets kept. |

## Documents (C-562 to C-625)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-566 | ◐ | The card keeps the viewport height so the tree scrolls inside it (long trees). |
| C-568 | ◐ | Field width grows 180 to 260 px; full row under 1000 px (fits the real toolbar). |
| C-571 | ✓ | 1.5 px edge, 3 px padding, 22 px buttons from 768 px; the choice still saves to preferences. |
| C-572 | ◐ | Label kept at every width (clearer); real ZIP stream. |
| C-573 | ◐ | Upload shows only with open requests: every client upload must answer a request (no free upload path). |
| C-574 | ◐ | The 700 to 999 px stacked layout and the phone board stay (real layouts tested on phones). |
| C-575 | ◐ | Every folder starts open: the prototype's preset open list is sample data. |
| C-578 | ◐ | The track stays a button that opens the drill (extra real feature). |
| C-579 | ◐ | The drill dialog stays (extra real feature). |
| C-580 | ◐ | Not changed: 23 px indent fits five levels in the 440 px tree. |
| C-583 | ✓ | DOCX blurple, spreadsheets (XLSX, XLS, CSV) green, PDF red; images stay violet to match the shared FileBadge. |
| C-585 | ✓ | Missing files read regular weight in ink-2. |
| C-587 | ✓ | Hidden under 640 px only. |
| C-588 | ◐ | Hidden under 640 px; "Requested" stays for a request with no due date (real case). |
| C-589 | ✓ | Waiting is an outline person, Late an alert circle. |
| C-590 | ✓ | 30 px button with horizontal dots. |
| C-591 | ◐ | Menu icons kept; no C key shortcut (not built). |
| C-592 | ◐ | "Preview" and "Open step N" kept (real). |
| C-593 | ◐ | "Open step N" kept (real). |
| C-597 | ◐ | The real empty card keeps "Open incorporation". |
| C-598 | ◐ | Real loading state kept. |
| C-599 | ◐ | Real error state kept. |
| C-602 | ◐ | The real first page shows instead of sample lines. |
| C-603 | ◐ | DOCX renders through the real renderer; the "not available" card shows in the viewer. |
| C-604 | ✓ | Up to 340 px, accepted types and size from the real accept list under the title, secondary "Choose file"; drag state kept. |
| C-605 | ◐ | Extra "Note" row kept (real note from SBC). |
| C-606 | ✓ | Plain blurple link, no icon or tooltip. |
| C-607 | ◐ | 1 px edge, 15 px title, 32 px close; the sheet still starts at 700 px (the phone board breakpoint). |
| C-608 | ✓ | 1 px list edge, 13.5 px rows. |
| C-609 | ✓ | Auto-width chips; "Overdue · 9 Oct". |
| C-611 | ✓ | 1 px dashed line edge, 13.5 px text, 11.5 px caption. |
| C-612 | ◐ | One file per request, so the picked file shows in the drop zone; no per-file list. |
| C-614 | ◐ | "Sent to <lead> for review" names the real reviewer. |
| C-615 | ◐ | The ZIP toast keeps its real progress. |
| C-617 | ◐ | The phone drill-down board stays (built for phones). |
| C-618 | ✗ | The phone board has no Status, Replaced, arrange or ZIP-all controls yet. |
| C-619 | ◐ | Phone preview is a bottom sheet with Ask and Download. |
| C-620 | ◐ | Action sheet with Take photo and Choose file (real camera upload). |
| C-621 | ◐ | 700 to 767 px keeps the stacked explorer. |
| C-622 | ◐ | Extra real keyboard tree kept. |
| C-623 | ◐ | Extra real deep links kept. |
| C-624 | ◐ | "Other documents" holds real step-less files. |
| C-625 | ◐ | Paper stays white in dark mode so scans read true. |

## Doc viewer (C-626 to C-649)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-626 | ◐ | Overlay state, no route per file. |
| C-627 | ✓ | `--scrim` token (navy 42 %, black 60 % in dark). |
| C-628 | ◐ | Width capped at 1152 px. |
| C-629 | ✓ | Full area under the top bar, no corners, on phones. |
| C-631 | ◐ | Meta stays in the info pop-over (adds the step). |
| C-635 | ✓ | Side buttons hidden under 768 px. |
| C-636 | ✓ | Phone footer bar with Previous, "i / n" and Next. |
| C-637 | ✓ | White pill, 1.5 px line edge, ink text, 38 px. |
| C-638 | ◐ | Page arrows not built: the PDF renders in an iframe that the page cannot step. |
| C-639 | ✓ | Steps 50, 75, 100, 125, 150, 200 %; the percentage resets to 100 %. |
| C-642 | ◐ | Smaller dialog for an unsupported file. |
| C-643 | ◐ | Real loading state kept. |
| C-644 | ◐ | Real error state kept. |
| C-646 | ◐ | Enter motion kept (off with reduced motion). |
| C-647 | ◐ | Follows the visible tree rows. |
| C-649 | ◐ | White paper in dark mode (see C-625). |

## Library (C-650 to C-705)

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-651 | ◐ | The controls stay in the shelves card head (the company title names the library). |
| C-652 | ◐ | 36 px field kept to match the head height. |
| C-653 | ◐ | The brief is a real download behind the feature flag; there is no brief book. |
| C-655 | ◐ | Search stays inside the card under its head. |
| C-656 | ◐ | Order follows the card layout above. |
| C-658 | ✓ | Every read book shows (no cap of 3); cover shading kept. |
| C-659 | ◐ | Opens the dialog on the matching tab (more direct). |
| C-660 | ◐ | 600 px; no section note (reads store a percentage only). |
| C-666 | ✓ | Flat navy band at 45 %. |
| C-667 | ✓ | Flat grey strip with a 1 px line on three sides. |
| C-670 | ◐ | Own glyphs at the shelf tones. |
| C-672 | ✓ | Lifts 12 px and turns -2deg in 0.3 s, no shadow (the dimming of other books stays). |
| C-673 | ◐ | Load motion kept (R-41 motion moment), off with reduced motion. |
| C-674 | ◐ | Real shelves come from saved answers; there is no SBC SOPs shelf in the data. |
| C-677 | ◐ | Real empty library kept. |
| C-678 | ◐ | Real loading kept. |
| C-679 | ◐ | Real error kept. |
| C-684 | ◐ | Extra real learn route kept. |
| C-685 | ◐ | Reader width capped at 780 px for reading. |
| C-689 | ✓ | Depth switch: 1.5 px edge, 3 px padding, 28 px buttons. |
| C-693 | ◐ | Extra real chart or table kept. |
| C-697 | ◐ | "PDF brief" needs a saved item (the export reads the saved row). |
| C-698 | ◐ | Save moves to the saved item's URL, so no Undo on save. |
| C-699 | ◐ | Calendar tile kept (the card lists dates). |
| C-700 | ◐ | Real status chip and owner tag kept. |
| C-702 | ✓ | Head tile teal book; each row tile takes its shelf tone and icon. |
| C-704 | ◐ | Real loading kept. |
| C-705 | ◐ | Real "not available" card kept. |

## Request from the client home agent (C-076)

Added `hideRevealedIdentifier(field: 'pan' | 'tan')` to `src/components/client-portal/pages/credentials/IdsRevealDialog.tsx`. It clears the revealed value and its timer in the shared store, so `useRevealedIdentifier` and `RevealCountdown` go back to masked at once. The PAN and TAN reveal holds no server grant (the value is returned once and kept only in this store), so no API call is needed. Usage: `import { hideRevealedIdentifier } from '@/components/client-portal/pages/credentials/IdsRevealDialog'` and call it from the hide button.

## Files changed (round 2)

- src/components/client-portal/pages/team/team-sections.tsx — `avatarColor` → `avatarTint` (tsc fix); Team rows C-886 to C-907.
- src/components/client-portal/pages/team/SettingsPage.tsx — rewritten as the Profile page (220 px menu, seven sections, `?tab=` and old hashes).
- src/components/client-portal/pages/team/profile/{use-profile.ts,sections.tsx,settings-view.tsx,password-form.tsx,whatsapp-dialog.tsx} — new.
- app/app/client/profile/page.tsx — new route (same entry as settings).
- src/components/client-portal/pages/team/{AnnouncementsPage,NotificationsPage,AuditPage,common}.tsx — Announcements fixes, tab-switch skeleton (`useTabFlash`), Audit empty and date label.
- src/components/client-portal/css-src/{team-settings,team-team,team-ann,team-notif,team-audit,team-00-contract}.css — regenerated with `node scripts/cp-css.mjs`.
- src/components/client-portal/pages/credentials/{Ic.tsx,icons.ts,cell-controls.tsx,use-credentials-state.ts,id-tiles.tsx,CredentialsPage.tsx,OtpDialog.tsx,IdsRevealDialog.tsx}; src/lib/client-portal/credentials.ts (sheet name); css-src/credentials-page.css.
- src/components/client-portal/pages/documents/{Explorer.tsx,UploadDialog.tsx,DocViewer.tsx,file-types.ts,model.ts}; css-src/{documents-explorer,documents-boards,documents-viewer}.css.
- src/components/client-portal/pages/documents/library/{LibraryPage.tsx,Reader.tsx}; css-src/{library-shelf,library-reader}.css.
- src/db/repositories/client-documents.test.ts — new cross-tenant test (upload and undo scoped to the own engagement and uploader; closed_at set and cleared).

## New routes

- `/app/client/profile` (renders the same page as `/app/client/settings`).

## Schema needs

- `profiles.designation text` (client designation for About you, C-821, and the role column on Team, C-888 / C-898; could be `client_people.role` if roles are per engagement).
- `notification_prefs.remind_days smallint` (7, 3 or 1) for "Remind me before a due date" (C-831).

## Requests for shared files

- Shell: a text-size setting (Small / Default / Large) on `.cp` for C-832; the portal CSS is in px, so it needs a shell-level scale.
- Shell sidebar (`Sidebar.tsx`): the profile entry can point to `/app/client/profile`; Team may move under Profile (`?tab=team`) if the owner wants the prototype's redirect.
- `src/views/notifications/notification-view.ts` and `client-audit.ts` CTAs still link `/app/client/settings#notifications`; that hash now opens the Settings section (the matrix), so nothing breaks.

## Decisions

- The Profile page reuses the staff `TwoStepRows` and `DevicesRows` (real two-step sign-in and devices) inside Tailwind islands instead of forking them.
- The Settings section is drawn in Tailwind islands (SCard from compliances/spectrum) to match the prototype exactly; the Team section keeps the team CSS outside any island.
- WhatsApp consent stays unticked by default (an opt-in must be an active choice); the dialog shows Number › Done because the code step is not live.
- "Remove photo" moved from the camera menu to About you; the camera opens the picker directly.
- Credentials keeps the page-wide Preview / Edit (renamed "Preview all" / "Edit all") and the row and cell OTP controls: they are real grant scopes.
- Image file badges stay violet to match the shared FileBadge; DOCX turned blurple and spreadsheets green as both prototype parts agree.

## Checks

- `npx tsc --noEmit -p .`: clean for my files (other areas' errors from the start of round 2 are gone or not mine).
- `npx vitest run` on src/db/repositories/client-{documents,audit,change-requests}.test.ts, src/components/client-portal, src/lib/client-portal: all pass.
- `npx eslint` on my folders: 0 errors (45 existing warnings).
