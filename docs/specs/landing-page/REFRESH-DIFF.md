# Portal refresh: what is changed and what is left

Source of the rules: the "VCFO Portal Refresh" document (claude.ai/artifact/RhNoYnFXSJgV1TU4fFrFws).
Status on 26 Oct 2026, prototype version 6 (after the "fix everything" pass). Written in ASD-STE100 Simplified Technical English.

Key: ✓ = changed. ◐ = partly changed. ✗ = not changed yet. — = not changed, because the owner decided.

## Rules that apply to all screens

| # | Item | Refresh rule | Status | Note |
|---|---|---|---|---|
| 1 | Colours | Use the refresh colours (navy, blue, green, amber, red, each with a soft tint) | ✓ | All screens get the new colours |
| 2 | Font | Use Public Sans. Use mono only for IDs | ✓ | |
| 3 | Text case | Use sentence case. Do not use capitals for headings | ✓ | Acronyms and names stay |
| 4 | Status marks | Show status as a soft chip with a dot. Do not use solid blocks | ✓ | |
| 5 | Lines | Do not use colour lines for decoration | ✓ | Owner, 26 Oct |
| 6 | Table heads | Use a navy tint and a thin grey line | ✓ | |
| 7 | Card heads | Use a 52 px head, a thin line, a 14.5 px title and a tinted icon tile | ✓ | Icon tile comes from the title |
| 8 | Tabs (segmented buttons) | Use small buttons. Show the selected button in navy. Do not use a sliding highlight | ✓ | |
| 9 | Primary buttons | Use navy for the main button | ✓ | All solid blue main buttons are navy now |
| 10 | Search shortcut | Show "Ctrl K" | ✓ | |
| 11 | Sidebars | Sort items by priority | ✓ | Owner, 26 Oct |
| 12 | Dark mode | Use slate colours | ✓ | Slate surfaces (#111821, #18202B); every fixed colour has a dark twin |
| 13 | Design book | Show the refresh rules (version 1.5) | ✓ | Version 1.5 published; design-tokens.json, TOKENS.md and COMPONENTS.md are still at 1.4 |
| 14 | Phone and tablet screens | Use the same card rules | ✓ | Phone home: navy band and white number strip, sentence case heads, no ring, no orange tabs. Tablet checked |

## Client portal

| # | Card or page | Refresh rule | Status | Note |
|---|---|---|---|---|
| 15 | Greeting card | Navy band with the name, then a white strip of numbers, each with an icon tile | ✓ | |
| 16 | Your next action | One line with the action and one button | ✓ | |
| 17 | Timeline (home) | Rounded 16 px bars, a status circle per row, an expand arrow, a hatched late part, an orange COI mark | ✓ | 46 px rows, status circles, 16 px bars, orange COI mark. The data has no late part, so no hatch shows |
| 18 | Steps | Flat phase rows with a 6 px bar and a count chip | ✓ | |
| 19 | Needs from Northwind | Tabs in the card head, checkbox rows | ✓ | |
| 20 | Important alerts | Rows with a 44 px date tile. The urgent row has a red wash and a small navy button | ✓ | The urgent tile shows "!" because the data has no date |
| 21 | What is next | Same as Important alerts | ✓ | |
| 22 | What SBC is doing | Soft bars in category colours. No info icons. No link buttons | ✓ | |
| 23 | Compliance by area | Small tabs, table with a mix bar | ✓ | |
| 24 | Compliance status (donut) | Card head and legend in the refresh style | ✓ | The total and one stacked bar replace the donut |
| 25 | Company IDs | Soft chips | ✓ | "Private" is a quiet grey chip; the show button is soft |
| 26 | Recent documents | Full-width rows with thin lines | ✓ |  |
| 27 | Recent activity | Full-width rows. Tabs stay on one line | ✓ | |
| 28 | Post-incorporation setup | Rows with bars and owner chips | ✓ | Full-width rows, 6 px bars, owner chips with a dot |
| 29 | Incorporation: COI card | White number, quiet label, soft chip, one bar in parts by phase. No ring | ✓ | Fixed 26 Oct |
| 30 | Incorporation: step count | 25 steps in 3 phases | ✓ | Registration left incorporation |
| 31 | Incorporation: This week | Equal owner chips with a dot | ✓ | 96 px owner chips with a dot |
| 32 | Incorporation: Timeline | Expand arrow on each row. No "Steps" or "Open" buttons | ✓ | Axis ends in November; 16 px bars, blue current bar, orange COI mark |
| 33 | Incorporation: four charts | One strip with thin lines between the charts | ✓ | |
| 34 | Compliance calendar | Thin grid, tinted day numbers, today in soft blue | ✓ | |
| 35 | Coming up (calendar) | Tinted date tiles | ✓ | |
| 36 | Registrations and Obligations | Risk strip, groups, law chips, right rail | ✓ | Built in round 3 |
| 37 | Documents, Library, Credentials, Team, Audit, Updates | Card rules | ✓ | Checked page by page; WhatsApp buttons on Team are soft |

## Staff portals (project lead, manager, admin)

| # | Card or page | Refresh rule | Status | Note |
|---|---|---|---|---|
| 38 | Greeting card | Navy band, white number strip with icon tiles | ✓ | |
| 39 | Practice strip | One slim strip of three numbers | ✓ | |
| 40 | Action queue | Card head with icon tile | ✓ | Empty cells are blank; counts are soft chips |
| 41 | Inbox and Waiting on client | Card heads with icon tiles | ✓ | |
| 42 | Team tasks (manager) | Table with status chips such as "Overdue · 2d" | — | Owner chose a checkbox and a status icon (Linear style) |
| 43 | Task status (manager) | One stacked bar with a legend | ✓ | |
| 44 | This week (manager) | Week strip. Only today is tinted. A late day shows " · late" in red | — | Removed with your approval in the Lead Today cuts (Part 7); the Calendar shows the week |
| 45 | Phase progress | Phase rows with 6 px bars | ✓ | A 6 px bar per phase with the count under it |
| 46 | Clients × filings | Tinted cells | ✓ | Not applicable cells are blank; upcoming cells are light |
| 47 | Waiting for your approval | Small navy action buttons | ✓ | Buttons are navy |
| 48 | Admin practice cards | Card heads with icon tiles | ✓ | |
| 49 | Admin: Clients · where each one is | Table fits in the card | ✓ | The table fits the card |
| 50 | Work, Clients, Overview, Filings, Email, Vault | Card rules | ✓ | Checked page by page. The client list now counts 25 steps in 3 phases |

## Super admin

| # | Card or page | Refresh rule | Status | Note |
|---|---|---|---|---|
| 51 | Greeting card | Navy band, white number strip with icon tiles | ✓ | |
| 52 | Overview, Clients, Risks, Growth, Reports | Card rules | ✓ | Checked; the Clients table fits its card |
| 53 | Money | Remove all money | ✓ | Owner, 26 Oct |

## Developer

| # | Card or page | Rule | Status | Note |
|---|---|---|---|---|
| 54 | All pages | lcc Settings shape: a section rail, then cards of label and value rows | ✓ | Owner, 26 Oct |
| 55 | Connections | Full detail for each connection (WhatsApp, email, SMS, Outlook, Teams, extension, payments, Ask VCFO, storage, errors, API keys) | ✓ | |
| 56 | AWS costs | Keep | — | Owner decided |

## Owner decisions that differ from the refresh

| # | Item | Refresh | Owner decision | Status |
|---|---|---|---|---|
| 57 | Task rows | Status words | Checkbox and status icon | — |
| 58 | Client colours | Neutral | Each client keeps its colour | — |
| 59 | Dates | Words ("3 d overdue") | Plain dates ("14 Oct"), red when late | — |
| 60 | Developer greeting | Navy greeting | No greeting. Settings shape | — |

## Totals

| Status | Count |
|---|---|
| ✓ Changed | 53 |
| ◐ Partly changed | 0 |
| ✗ Not changed yet | 0 |
| — Owner decision | 7 |
