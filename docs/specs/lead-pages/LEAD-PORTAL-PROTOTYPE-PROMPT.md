# Prompt: make the Lead portal prototype work exactly like VCFO Suite

Copy everything below the line into the browser prototyping tool that hosts
`vcfosuite-client-dashboard.vercel.app`. It describes the real Project Lead
portal of VCFO Suite (the Next.js app, as it runs on localhost on 2026-10-21,
including the client-vs-lead changes made that day). Written for: an AI
prototyping tool that updates an existing HTML/JS prototype.

---

You are updating the existing **VCFO Suite — Lead portal** prototype (the one with the
dark navy sidebar: Today · Work · Clients · Email · Docs · Updates · Compliances, the SBC
logo in the top bar and the "PREVIEW · All incorporating · Mixed · All compliance" switch).
Do not restyle it. Keep its colours, cards, icons, fonts and the preview switch exactly as
they are. Your job is **functional parity**: every screen, button, filter, tab, badge,
state and rule below must exist and behave as described, with fake data. Nothing may be a
dead button. Where the prototype already has a feature that the real app does not have,
keep it but label it "NEW". Where the prototype is missing something below, add it in the
prototype's own style.

The user of this portal is a **Project Lead** (code role "intern" — never show the word
intern in the UI; the role label is "Project Lead"). A lead runs company incorporations
for several client companies at once, under one or more Project Managers.

## 0. Vocabulary and the people in the fake data

- **Lead**: the signed-in user. Name: Sneha Kulkarni. Role label "Project Lead".
- **Managers**: Anita Desai (primary), Joseph Mathew. Each has an email.
- **Clients (companies)**, each with a client contact, a colour and a stage:
  - Northwind Technologies — INC (incorporating, SPICe+ Part A), violet
  - Orchid Lane Foods — INC (SPICe+ Part B), indigo
  - Larkspur Analytics — INC (Post-incorporation), green
  - Juniper Mobility — INC (Registration), slate
  - Brightwave Robotics — CMP (compliance, incorporated), pink
  - Tidewater Logistics — CMP, teal
  - Kestrel Health — CMP, sky
  - Halcyon Payments — CMP, ochre
- **Stages** (one per company): "Pre-Incorporation", "Post-Incorporation", "Operational
  Readiness". A company counts as **incorporated** once it has a Certificate of
  Incorporation date, or its stage is not Pre-Incorporation, or step pre-12 is complete.
- **Company type**: "Subsidiary" (has a parent entity, foreign or Indian) or
  "Independent" (standalone). Independent companies skip every parent-entity tab and the
  two board-resolution steps (pre-2, pre-3 read "N/A").
- Times and dates are **IST** everywhere ("12 Oct 2026, 4:05 pm").

## 1. The incorporation checklist (the heart of the product)

48 active steps in 4 phases. Each step has an id, a title, and an **owner**: the client
("Client") or the firm ("Project Lead"). Keep the ids; they appear in URLs
(`/engagements/{company}/step/{slug}`) and in document links.

**SPICe+ Part A** (phase 1, "Pre-incorporation")
| # | id | slug | title | owner |
|---|---|---|---|---|
| 1 | pre-1 | name-application | Client Details | Client (client-intake) |
| 2 | pre-2 | board-resolution-draft | Draft Board Resolution | Project Lead (the only step with manager approval) |
| 3 | pre-3 | board-resolution-execution | Signed Board Resolution | Client |
| 4 | pre-4 | name-application-filing | Name Application | Project Lead |
| 5 | pre-5 | mca-name-approval | Name Approval | Project Lead |

**SPICe+ Part B** (phase 2, "Pre-incorporation")
| # | id | slug | title | owner |
|---|---|---|---|---|
| 6 | pre-13 | capital-structure | Capital Structure | Client (client-intake) |
| 7 | pre-14 | registered-office-address | Registered Office Address | Client (client-intake) |
| 8 | pre-15 | proposed-directors | Proposed Directors | Client (client-intake) |
| 9 | pre-16 | subscriber-details | Subscriber Details | Client (client-intake) |
| 10 | pre-7 | kyc-review-and-dsc-creation | KYC Review & DSC | Project Lead |
| 11 | pre-9 | spice-part-b-confirmation | SPICe+ Confirmation | Client |
| 12 | pre-10 | incorporation-filing | SPICe+ Filing | Project Lead |
| 13 | pre-11 | mca-remarks-resubmissions | MCA Remarks | Project Lead |
| 14 | pre-12 | certificate-of-incorporation-sharing | Certificate of Incorporation | Project Lead |

**Post-incorporation** (phase 3), all Project Lead, in this order: First Board Meeting
(post-1), Company Letterhead (post-9), Bank Account Opening (post-3), Share Capital
Infusion (post-4), Share Certificates (SH-1) (post-5), Commencement (INC-20A) (post-6),
Auditor Appointment (ADT-1) (post-2), FC-GPR Filing (post-7), Nominee Shareholder
(MGT-4/5/6) (post-8), Registered Office (INC-22) (post-11), Name Board (post-10).

**Registration** (phase 4), all Project Lead, grouped under sub-headers General, Customs,
Foreign Trade, Labour, Local Compliance, IP/Brand, FEMA: GST Registration (reg-4), PF
Registration (reg-1), ESI Registration (reg-3), PT Registration (reg-7), LEI Registration
(reg-6), MSME Registration (reg-15), ICEGATE Registrations (reg-16), IEC Registration
(reg-8), LUT Filing (reg-5), Non-STPI Compliance (reg-11), Shops & Establishment (reg-9),
CLRA Registration (reg-13), POSH / SHE Box (reg-14), Trade Licence (reg-10), Trademark
Registration (reg-12), Trademark Renewal (reg-17), Patent Registration (reg-18), ICDR
Registration (reg-19), FCGPR Filing (reg-20), FDI Reporting (reg-21), ODI Reporting
(reg-22), FLA Return (reg-23), FCTRS Filing (reg-24).

### 1a. Part A (pre-1 "Client Details") tabs, in this order

1. **Business Description** — "Brief description of the business and operations to be
   carried out by the entity in India (up to 100 words)" (textarea, word counter);
   **Main NIC code** (5 digits, lead-only); **Business type** (auto-filled from the NIC
   code, read-only); **Additional NIC codes** (repeat group, "+ Add NIC code", max 9, each
   with its own auto business type, lead-only).
2. **Proposed Company Names** — Proposed name 1, Proposed name 2 (both must end "India
   Private Limited").
3. **Foreign Entity** (subsidiaries only) — Name, Registration Number, Complete Address,
   Country of incorporation (type-to-search picker), State / province of incorporation
   (if any), Does the parent entity have a trademark? (Yes/No), Trademark document
   (optional upload).
4. **Foreign Entity Proof** (subsidiaries only) — Certificate of Incorporation (upload).
5. **Authorized Signatory** (subsidiaries only) — First name, Middle name (optional),
   Last name, Designation, Gender (Male / Female / Other segmented control), **and the
   signatory's KYC uploads on the same tab**: Passport, Driving Licence, Utility Bill <2
   months. There is NO separate "Signatory KYC" tab.
6. **Company Mail ID** — Company Mail ID.
7. **Company Mobile Number** — Country code (picker), Mobile number.
8. **Share Capital Details** — Authorized Share Capital (INR) (ex: 10,00,000), Initial
   Paid-up Share Capital (INR) (ex: 1,00,000), Nominal Value of Each Equity Share (ex: INR
   10), **Date of Board Resolution** (date picker; subsidiaries only; the lead may also
   edit this one), Remarks (optional).

Every select with 12 or more options (countries, Indian states, nationalities) is a
**type-to-search picker**: the trigger looks like a normal select; opening it shows a
search box at the top ("Type to search country of incorporation…"); typing "uni" filters
to United Arab Emirates, United Kingdom, United States of America; "No match." when
nothing fits.

### 1b. The flow rules (this is the part the previous prototype got wrong)

**Direct flow.** Every pre-incorporation step except pre-2 is a *direct-flow* step: the
client and the lead fill the same form and **Submit completes the step with no approval**.
The only pre-incorporation approval is the board resolution (pre-2): lead → manager →
client.

**Client-intake steps = pre-1, pre-13, pre-14, pre-15, pre-16.** These are the client's.
On them:
- The lead **cannot type the client's fields**. On the lead's form every client field is
  read-only with the helper line "The client fills this. It shows here once they submit."
- The lead edits only **Main NIC code, Business type, Additional NIC codes** (pre-1) and
  the **Date of Board Resolution** (pre-1). The other four intake steps have no lead
  fields at all.
- **While the client is still typing, the lead sees nothing of it.** The lead's copy of
  the step shows empty client fields ("Not provided yet") and a blue notice: "Waiting for
  the client to fill and submit this step. Their answers appear here once they submit; you
  can add the NIC codes meanwhile." (on pre-13 to pre-16 the sentence ends after
  "submit."). The step's gate reads **"Waiting on the client…"** on Today, My work, the
  engagement overview and the journey rail.
- **Once the client submits**, the client's answers appear on the lead's form
  (auto-populated, read-only). If the client's submit stopped only on the NIC codes, the
  step is *waiting on the lead*: notice "{Client name} submitted their part. Fill the NIC
  codes, then submit to complete this step." and the lead's **Submit** button appears.
  When the lead submits, the step is complete.
- If the lead presses Submit while a client field is still empty, that field shows the
  red error **"The client has not filled this yet."** and the tab gets a red dot. The
  footer line before the client submits reads "Waiting for the client to fill and submit
  this step." instead of a Submit button; on pre-13..16 after the client submits it reads
  "The client submits this step. Nothing to add here."
- The **parent entity** (Foreign Entity tab) is entered by the client, not by the
  manager: a Pre-Incorporation project is created without parent details and the client's
  Part A submit fills them in.

**Lead-owned steps** (pre-4, pre-5, pre-7, pre-10, pre-11, pre-12 and everything in
Post-incorporation and Registration): the lead fills them. Drafts autosave about 600 ms
after typing ("Saving…" → "Saved" in the footer; "Couldn't save — retry" on failure).
- Direct-flow lead steps (pre-4 … pre-12): **Submit** completes the step. Toast "Step
  submitted · {title} is complete." then the next step in the phase opens.
- Non-direct steps (pre-2, post-*, reg-*): **Submit** = **"Request manager approval"**.
  Toast "Submitted for approval · Your manager reviews it in Approvals; the client sees
  this step once they accept." The step then reads "Waiting on your manager…". A second
  button "Email manager again" re-sends the request (toast "Emailed manager again"). The
  manager can Accept (step complete, delivered to the client) or Reject with a note (step
  reopens for the lead as "Rejected — fix").
- **Visibility chain** for non-direct steps: lead drafts are private until "Request
  manager approval"; the manager sees them after the request; the client sees them only
  after the manager accepts. Direct-flow steps are visible to everyone, except the
  client-intake rule above (the lead sees intake answers only after the client submits).
- **Reopen step**: on a completed direct-flow step the lead has a "Reopen step" button
  (toast "Step reopened"); every later step re-locks.

**Board resolution (pre-2)**: generated from pre-1; the lead edits it in the Board
resolution editor and presses **"Send for manager approval"**. The manager approves
("Approve and send to client") or sends it back with a note. Once approved, the client
downloads, signs and uploads it in pre-3.

## 2. Shell (every page)

**Sidebar**, in this order (badges in brackets):
1. Today
2. Work [count of items that need action]
3. Clients [number of assigned companies] — a disclosure group. The panel lists every
   assigned company A–Z: coloured initials chip, company name, subtitle (client contact
   name, else the stage), and an INC / CMP tag. Last row "View all". Empty: "No clients
   assigned". The group is active on /clients and on any /engagements/* page.
4. Email
5. Docs → Vault, Knowledge Bank
6. Updates → Announcements [unread], Notifications [unread]
7. Compliances → Calendar, Filings — **shown only when at least one assigned company is
   incorporated** (the preview switch "All incorporating" must hide it; "Mixed" and "All
   compliance" show it).
8. hairline, then Analytics and Audit.
Below the nav (expanded rail only): a mini compliance calendar for the current month —
"{Month} {Year}" and "{n} due"; today is a filled cell, due days are ringed; click → the
compliance calendar (tooltip "Open compliance calendar").
Footer: avatar + name + "Project Lead" → Settings; a pin button that cycles **Auto (hover
peek) → Pinned open → Pinned closed**, with tooltips "Auto (hover). Click to pin open",
"Pinned open. Click to pin closed", "Pinned closed. Click for auto (hover)". In Auto the
rail peeks open on hover and is fully open on the Clients page; Pinned closed is an
icon-only rail with short labels and the Work badge.

**Top bar**, left to right: hamburger (mobile), SBC logo (→ Today), location trail
("Home › Clients › Northwind Technologies › Documents"), the PREVIEW switch (prototype
only — keep it), Search (Ctrl K), Announcements bell, Notifications bell, theme toggle
("Switch to light mode" / "Switch to dark mode"), Profile avatar (→ Settings). Every
nested page has a small back chevron immediately left of its H1.

**Command palette** (Ctrl/⌘ K only; Esc or click outside closes): input "Search" with the
⌘K hint; groups "Documents" (vault hits, up to 8, this lead's clients only), "Knowledge
Bank" (up to 8), "Project Lead workbench" (Today, My work, Clients, Document vault,
Announcements, Notification history, Send email, Analytics, Compliance calendar, Filings,
Audit log, Knowledge Bank), "Projects" (every company → its engagement page). Empty:
"Nothing matched. Try another term."

**Announcements bell**: unread badge (cap "9+"); dropdown "Announcements" with segmented
filter All / Important / General; rows open the announcement; footer "View all
announcements →"; empty "No announcements yet." Leads cannot write announcements.

**Notifications bell**: header "Notifications" + "{n} new"; "Mark all read"; segmented
"Received {count · unread}" / "Sent {count · unread}"; "Clear today", "Clear this week",
"Clear all"; rows grouped Today / Yesterday / Earlier, each dismissible with an undo toast;
footer "Notification history" and "Get these on WhatsApp" (→ Settings). Empty: "No
received notifications yet." / "No outbound email activity yet."

**"Your step right now"** (Today only): a fixed bottom-right card — eyebrow "Your step
right now", the step title, "Open" and an X. It hides after 12 s unless hovered; once
dismissed it stays hidden for that step for the session. It shows the first item that is
rejected, needs review, is ready to deliver, overdue, or in progress.

**Ask VCFO**: the real app shows the Ask VCFO assistant to clients only — **not** to
leads. If the prototype keeps the robot/chat button on lead pages, label it "NEW".

## 3. Today — `/today`

- Hero: H1 "Good {morning | afternoon | evening}, Sneha" (IST: before 12 / before 17 /
  else), a live IST clock, a gear "Greeting card settings" (Solid / Gradient / Images /
  Upload, "Reduce motion"), a ring "done today" = done ÷ (done + action), and four stat
  links: **Action** (→ /tasks?focus=action), **Overdue** (red when > 0, → ?focus=overdue),
  **Waiting** (→ ?focus=waiting), **This week** (→ ?focus=due).
- **THIS WEEK** strip: header "This week", right label "Mon–Sun · IST"; 7 day cells
  (today highlighted, past dimmed, weekends dashed, a day with a filing has a red heading);
  per-cell count chips by kind: filing (red), step (blue), nudge (pink), done (green).
  Clicking a day filters the queue below and shows "Showing Wed 22 (today) · N items ·
  Show all" plus "Open in My work →". Legend: Statutory filing / Step deadline / Nudge due
  / Done. Empty: "Nothing lands on this IST week. Overdue and undated open work appears on
  today."
- **ACTION QUEUE · BY COMPANY**: up to 6 company cards (waiting and done items excluded).
  Card header: initials, company name (→ engagement), status pill, expand chevron. Pill,
  first match wins: "{n} rejected" (red) → "deliver ready" (green) → "filing due" (cyan)
  → "{n} overdue" (red) → "In progress" (sky) → "{n} open". Expanded: up to 3 rows, each
  with icon, title (→ step), kind chip, age chip and a CTA (table below). Expanded state
  remembered. Empty "Nothing needs you right now." Footer "View all work →".
- Right of the queue: **TODOS** ("From queue" popover with "Filter queue…" to pin open
  items; input "Type a todo…" + "Add"; rows with a round checkbox "Mark done" and an X
  "Remove from todos"; pinned rows show title, company, kind chip; empty "Type a todo —
  Add what you need to get done — or pin work from the queue."), **MY COMPANIES · PHASE
  PROGRESS** (one row per company: name, chip Stuck (red) / Complete (green) / In progress
  (sky), four segmented bars Part A / Part B / Post-inc / Registration with percent fill;
  tooltip "{phase} · pre-n · day N · stuck"), **MY MANAGERS** (name, email, mail icon →
  /mail?to=…).
- Right rail: **COMPLIANCE HEALTH** (donut with total "filings"; legend Filed · n, Due
  soon · n, Overdue · n, Upcoming · n; the next 2 unfiled filings as "day · name ·
  authority · due label" → calendar), **WAITING ON** (top 5 waiting items; empty "Nobody
  is blocking you.").

**Work-item kinds** (used by Today and My work):
| kind | chip colour | state text | CTA |
|---|---|---|---|
| rejected | red | "Rejected — fix" | "Open step" |
| review | blue | "Client submitted — review" | "Review" |
| deliver | teal | "Accepted — deliver" | "Deliver" |
| overdue | red | "Day N · overdue" | "Continue" |
| in-progress | sky | "Day N" / "In progress" | "Continue" |
| waiting-client | violet | "Waiting on the client" / "Waiting client · 3d" | "Send reminder" (→ /mail) |
| waiting-manager | pink | "Waiting manager · 2d" | "Email manager again" |
| waiting-request | cyan | "Document request · Client · 1d" | "Open company" |
| filing | cyan | "Overdue" / "Due today" / "Due in N days" | "Open filing" (→ calendar) |
| done | green | "Done" / "Filed" | — |
Sort order: rejected, overdue, filing, review, deliver, in-progress, waiting-manager,
waiting-client, waiting-request, done. A client-intake step the client has not submitted
is a **waiting-client** item for the lead.

## 4. Work (My work) — `/tasks`

- Header: "{open} open · {n} companies". View switch **List / Board / Timeline**
  (default Timeline; last choice remembered and kept in `?view=`).
- Filter chips kept in the URL: "All companies" + one chip per company; "Steps + filings"
  / "Steps only" / "Filings only"; a day chip "Wed 22 · IST" when `?day=` is set (click
  clears it). `?focus=action|overdue|waiting|due` from the Today stats filters too.
- **List**: columns Step / filing · Company (chip) · State (kind pill) · Due ("today",
  "12 Oct", "—", red when overdue) · CTA. Done rows dimmed and struck through. Keys
  **j / k** move the highlight, **Enter** opens.
- **Board**: four columns with counts — "Needs action" (blue), "In progress" (violet),
  "Waiting" (sky), "Done this week" (green); cards show title, company pill, kind chip,
  CTA.
- **Timeline**: a 14-day IST Gantt; header "Task" + day columns, today highlighted; rows
  grouped by company; bars carry the state text; colours: done dark green, overdue
  amber-brown, due in ≤ 3 days dark slate, otherwise light grey with a border; a section
  "Later / outside this fortnight" for the rest.
- Empty: "Nothing in this view — Clear a filter or pick another company."
- Todos on this page: grouped "Assigned by manager" / "My to-dos" / "Recurring this month"
  if the prototype already has them (label as NEW: the real app has only the Today todo
  list).

## 5. Clients — `/clients`

- Subtitle "{n} active engagements". A grid of company cards: initials, company name,
  stage eyebrow, progress ring (setup %), bar "{pct}%", INC / CMP tag. Click → the
  engagement overview. Empty: "No engagements assigned yet". If the prototype's table
  variant (4-phase stepper, stage chip, step now, ball dot, SPICe+ ring) exists, keep it.

## 6. Engagement overview — `/engagements/{company}`

- Header card: back chevron, H1 = company name, client email as a mailto link, **CC**
  chips ("Copied on client progress emails for this project."): first two emails as chips
  with an X, extra ones behind "+N", "+ Add" opens an input (Enter confirms, Esc cancels;
  errors "Enter a valid email address.", "That address is already on this project.",
  "Maximum 10 additional CC addresses per project."; toast "CC list updated").
- "Syncing client answers…" while refreshing.
- **Timeline** card (read-only for the lead): headline chip Completed / Waiting for you /
  In progress; bars "Phase 1 · Name Application", "Phase 2 · Incorporation", "MCA review",
  "COI" (milestone); clicking a bar expands its step list; legend Completed / In progress
  / Waiting for you / Not set / "Today {date}"; drag / swipe / shift+scroll to pan,
  ‹ Today › buttons, − / + / Fit zoom. No "Request a change" for the lead.
- **Phase list** — four rows: "SPICe+ Part A" (subtitle Pre-incorporation), "SPICe+ Part
  B" (Pre-incorporation), "Post-incorporation", "Registration". Each row: a done mark
  (tick when every step done), title + subtitle, the manager's date window on the two
  SPICe+ rows (mono, calendar icon), a **tick track** (one equal tick per step, filled when
  done, tooltip = step title), "{done}/{total}", chevron. Click → the first not-done step
  of that phase. On Part A and Part B rows a **Documents {ready} / {total}** pill (green
  when all ready, amber otherwise) → `/engagements/{company}/documents?part=part-a|part-b`.
- Part B rows open in place (set-A glyphs) if the prototype already does that; otherwise
  rows navigate.
- Not found: "This project isn't in your portfolio — it may have been removed or you don't
  have access."

## 7. Step page — `/engagements/{company}/step/{slug}`

- Title row: back chevron, H1 = step title. No "What's this?" for the lead. On narrow
  screens a "Document pack" button (Part A/B steps only).
- **Notice block** (direct-flow steps): "Last edited by {name} ({Client | Project Lead}),
  {date, time IST}"; the gate message ("Waiting on the client…"); the lead notices from
  §1b in a blue box.
- Layout: form column + sticky right **journey rail** (hidden below large screens).
- **Journey rail**: eyebrow = phase ("SPICe+ Part A"); one row per step in THIS phase
  only (never all four phases): numbered node (tick = done, blue = current, dim =
  upcoming), title, a person icon (grey = Client, blue = Project Lead), the waiting
  message under the current row, the window label. Every row clickable. Kebab "Step
  actions" → "Attachments required": required uploads with a green tick (uploaded) or an
  empty circle, or "None".
- Under the rail on Part A/B steps: **Pre-incorporation documents** card — "{ready} of
  {total} ready", stacked bar, legend "n ready to download / n need inputs / n waiting for
  release", button "Open document pack", "Fastest unblock: {input} in this step releases N
  documents."
- Form column, top to bottom:
  1. Doc source strip (Part A/B): "{n} documents use this step's data · {r} ready, {x}
     need inputs, {y} waiting for release · Open in document pack".
  2. "Copy for Assist" panel on pre-4 and pre-10 only: button "Copy for Assist", badge
     "Nothing missing" or "{n} missing", "Show details / Hide details", toast "Profile
     copied for Assist".
  3. pre-3 status line: "Signed copy received from client." / "Draft released — awaiting
     client upload of signed copy." / "Finalize the draft board resolution in Step 2
     before the client can sign."
  4. **The form**: a single-row **section tab strip** (scrolls sideways, edge arrows when
     it overflows; a tab shows a green tick when complete and a red dot "Needs attention"
     when it has errors). Fields pair two per row on desktop; textareas, uploads and
     addresses span the full width. Uploads are compact dropzones "Choose file · PDF,
     DOCX, or image · max 50 MB". Repeat groups (directors, subscribers, NIC codes) have
     "+ Add …" and per-entry remove. Date fields are type-or-pick (DD/MM/YYYY). After a
     failed Submit an error summary "{n} items need attention before you continue" lists
     up to 8 links that jump to the tab and focus the field; fields get red borders.
  5. **Footer**: left — autosave status ("Saving…", "Saved", "Couldn't save — retry");
     on non-direct steps the buttons "Request manager approval" (or "Email manager again")
     and "Request client to fill" (dialog "Request client to fill {step}", field "Note for
     the client", buttons Cancel / "Send for approval"; status line "Awaiting manager
     approval" / "Awaiting client" / "Client submitted" / "Request declined"). Right —
     "Save" (only while a save is pending or failed), then the primary button **"Next"** on
     every tab except the last and **"Submit"** on the last tab ("Submitting…" while busy),
     or the client-intake status text from §1b instead of Submit.
  6. On **pre-2** a blue card above the footer → the Board resolution editor, labelled
     "Generate draft board resolution" (badge "Not started") / "Draft generated — continue
     editing and finalize" ("Draft saved") / "Board resolution finalized — shared with
     client" ("Shared with client"). pre-2's own fields: "Draft generated on", "Shared
     with client on", "Draft/review notes (optional)".
  7. "Reopen step" (right-aligned) on a completed direct-flow step.
  8. **Request files from the client** panel on steps with uploads: note "Shown on the
     client's step page; approval waits for them"; existing requests as "label · due ·
     Uploaded · file" or "Waiting on client · Cancel"; form File (select) · Name the client
     sees · Due (date) · Note (optional, "e.g. Max 2 months old") · "Request".
- Status colours everywhere: completed green, your turn blue, with the team amber,
  upcoming grey, overdue/rejected red.

## 8. Documents (document pack) — `/engagements/{company}/documents`

- Back chevron, H1 "Pre-incorporation documents", subline "{Company}. Generated from
  SPICe+ Part A and Part B. Regenerates on every download unless a version was attached to
  Pre-7."
- Chips "{n} ready" (green), "{n} need inputs" (amber), "{n} waiting for release" (grey);
  right: **"Download ready ({n}) as .zip"** (disabled with tooltip "Nothing is ready to
  download yet").
- Part filter (`?part=`): "All (n)" / "SPICe+ Part A (n)" / "SPICe+ Part B (n)". Each part
  has a header with a progress bar "{ready} of {total}".
- Rows: type tile (PDF / DOCX), name (+ "· {director}"), "from {source steps}"
  (e.g. "Pre-1 · Attached to Pre-1"), provenance "Generated now" / "Attached to Pre-7 ·
  date" / "Finalized · date", status chip Ready / Needs inputs / Waiting for release,
  missing-input pills "{input} in {step}" linking to that step's tab, "Opens once the
  board resolution is finalized in {step}." when blocked, buttons Preview (eye; opens the
  right-hand preview pane "Preview · Ready · MOA · page 1 of 6") and Download .docx.
  Both disabled unless Ready.
- Documents: Part A — Name reservation (RUN), Board resolution; Part B — DIR-2, DIR-8,
  INC-9, PAN undertaking, ID & address declaration, Deposit declaration, Memorandum of
  Association, Articles of Association, Authorisation letter, Acceptance letter, MOA
  subscription sheet, AOA subscription sheet, Name NOC from parent.
- Footer line when a director is skipped: "Not in the pack yet: Proposed Directors →"
  linking to pre-15. Empty: "No documents in this part — Switch the filter to see the rest
  of the pack."

## 9. Board resolution editor — `/engagements/{company}/board-resolution`

- Eyebrow "Legal document", back chevron, H1 "Board Resolution", badge "Finalized —
  client visible" once finalized.
- Banners: "The board resolution is with your manager. You can edit it again if they send
  it back." / "Your manager sent this back: {note}" / **"Date of board resolution: {12 Oct
  2026 | not set} · Change date · Then use Re-generate from Pre-1."** (Change date → pre-1,
  Share Capital Details tab) / "Submit Client Details first. The board resolution uses this
  data. Open Client Details" / a missing-fields list with links "{label} — {step},
  {section}" / "Client uploaded signed copy · Received {date} · Download signed copy".
- Document panel: heading "Document" with save status "Unsaved changes" / "Saving…" / "All
  changes saved" / "Save failed"; formatting toolbar; inline-editable Word preview (locked
  once finalized or while with the manager; drafts autosave after 5 s); actions "Download
  Word document", "Re-generate from Pre-1", "Apply latest template"; without a document:
  "Generate the Word document first · Generate Word document from Pre-1".
- Bottom: "Save changes" and **"Send for manager approval"** (confirm dialog "Send the
  board resolution for manager approval?" — "Your manager reads the document and the
  Client Details it uses. When they approve it, the client can download, sign and upload
  it. You cannot edit it while your manager decides." Cancel / Send for manager approval;
  toast "Sent for manager approval"; the button then reads "Sent for manager approval",
  disabled). "Finalized {date}" once approved.

## 10. Email — `/mail`

- Left card "Outlook": "From" (connected mailbox, or "Outlook not connected · Connect
  Outlook in Settings."); "To" picker — search "Search names or type an email…", directory
  with checkboxes, filters "All teams" / "All clients", recipients as removable chips,
  Enter/comma/Tab adds a typed address; `?to=` pre-selects; "Subject"; when a template is
  applied: "Using {name} (SBC branded | Plain) · Write without a template"; "Message";
  "Send" (disabled without Outlook; toast "Email sent").
- Right card "Templates": "Create"; rows name · subject · branding badge (click applies);
  "Edit" / "Delete"; editor dialog Name, Description (optional), Subject, Message, Branding
  ("SBC branded" / "Plain"). Empty: "No templates yet · Create a template".

## 11. Vault — `/vault` and Knowledge Bank — `/knowledge-bank`

- Vault: stats "Documents {n}" and "Clients {n}"; left rail "Clients" (company · doc count
  · stage); header "{n} documents · {stage}" + "Open client"; search "Search by document
  name…" (results "{n} files matching '…'"); files grouped phase → step → section as cards
  (file name, field label, section chip, upload date, open in new tab). Empty: "No clients
  assigned yet · View clients" / "No files for this client yet" / "No documents match your
  search". Only this lead's clients.
- Knowledge Bank: folder breadcrumb "Folder path" + back; "New folder" (dialog Name ·
  Create folder) and "Upload document" (Title, Description (optional), File · Upload to
  library); search "Search files by name…"; folder cards and file cards (title, file name,
  folder path, description, "Download"). Delete is manager/admin only — not shown to the
  lead. Empty: "No documents yet" / "This folder is empty".

## 12. Announcements — `/announcements` and Notifications — `/notifications`

- Announcements: "Latest" list (click marks read and opens it); filters All / Important /
  General; "Official portals & circulars" directory in two bands "Setup & filings" and
  "Recurring", each task with "Portal" / "Circular" links. The lead cannot compose. Empty:
  "Nothing on the board yet".
- Notification history: segmented "All / Today / This week / Earlier" and "All / Received
  / Sent"; sections Today / Earlier this week / Earlier; a row expands to show "{timestamp}
  IST". Empty: "No notifications in this view".

## 13. Compliances — `/compliances/calendar` and `/compliances/filings`

- Only for incorporated companies. With none, both routes redirect to Today and the
  sidebar group is hidden.
- **Calendar**: H1 "Compliance calendar", "Open filings"; year control (Previous year /
  Next year), "All months", an "All / Overdue" toggle; company picker when more than one
  company; act strip GST, IT, MCA, FEMA, STPI/SEZ, Labour, RERA, TP (click toggles a
  filter); a 12-month year grid; a month opens the month board (Previous month / Next
  month, "BY ACT" list, grid lines between dates, today drawn as a whole highlighted box);
  a day opens a pop-up of its obligations ("Due date", "Due in", "Deadline", "Act",
  "Form"; status "Overdue by N days" / "Due today" / "Due in N day(s)"); legend "Done /
  Overdue / Hard deadline"; "Urgent pending"; month register "{Month} · your filings" with
  "View this month's filings" (rows Filed green / Overdue red / Due soon / Upcoming; empty
  "Nothing in your register falls due this month.").
- **Filings**: "Back to home", H1 "Filings", financial-year stepper, "Open calendar",
  company picker ("Whole portfolio"); segmented "Monthly / Quarterly / Annual" and "All /
  Filed / Overdue / Due soon / Upcoming"; glance tiles Overdue · Due in 14 days · Upcoming
  · Filed; register columns Sl No, Company, Compliance, Particular, Due Date, Filed Date,
  Frequency, Window, Status — the lead sees Window read-only (managers set it); monthly
  view has "This month / Full year" and Previous / Next. Empty: "No filings recorded for
  this period. Your calendar fills in as each registration goes live."

## 14. Analytics — `/analytics` and Audit — `/audit-log`

- Analytics: period select "Last 6 Months" / "Last 12 Months"; KPIs "Projects", "Steps
  completed" (%), "Waiting on client", "Overdue steps"; two charts tagged "Sample data":
  "Compliance completion rate" (monthly vs 95% target) and "Average filing delay" (days
  past due, benchmark 2d).
- Audit: tabs "Global logs" / "By project" (Project select); search "Search actions,
  actors, projects…"; role filter All roles / Manager / Project lead / Client; type filter
  All types / Projects / Milestones / Documents / Team / Email / Other; table When · What
  happened · Who · Target with role chips (Project lead chip is blue); rows expand. Empty:
  "No audit events yet" / "No matching events".

## 15. Settings — `/settings`

- Identity card: H1 = name, avatar Upload / Remove, Outlook photo button.
- "Profile" (Edit): Full name, Email (asks current password to change), Phone, WhatsApp,
  Role (read-only "Project Lead"); consent checkbox "Send me WhatsApp updates about my
  engagement on this number. Untick to withdraw, or reply STOP on WhatsApp at any time.";
  "Send test message".
- "Security" (Edit): Current / New ("8+ characters") / Confirm · "Update password".
- "Outlook": "Mailbox" row with "Connect Outlook" or "Disconnect"; states "Not configured
  yet. Ask an admin." / "Not connected".
- "Appearance": Greeting Card Appearance (Solid / Gradient / Images / Upload, live
  preview), Sidebar Appearance, Animations None / Minimal / Smooth / Dynamic / Ambient,
  "Reduce motion".
- "Sign out".

## 16. Notifications the lead receives (show them in the bell with these texts)

- Client submitted a direct-flow step → "{step} submitted" (and email).
- Client submitted Part A but the NIC codes are missing → "{step} · waiting on you".
- Manager accepted a request → "{step} accepted"; rejected → "Corrections requested";
  board resolution approved and sent → "Sent to client".
- Client asked for a change on a completed step → "Change requested · {step}".
- Client uploaded a requested file → "{file} uploaded".
- Manager approved / declined a "Request client to fill" → "Client fill approved" /
  "Client fill declined".
Every event also goes to email (and WhatsApp when enabled); the Sent tab of the bell lists
"email.sent / email.skipped / email.failed" rows.

## 17. Scenario the prototype must be able to show (use the preview switch or a demo menu)

For **Northwind Technologies** (subsidiary, Part A), show pre-1 in three states and let the
reviewer flip between them:
1. **Client typing** — lead opens pre-1: notice "Waiting for the client to fill and submit
   this step. Their answers appear here once they submit; you can add the NIC codes
   meanwhile."; Business Description "Not provided yet · The client fills this. It shows
   here once they submit."; Main NIC code editable (62011 → Business type "Computer
   programming activities"); Proposed names / Foreign Entity / Authorized Signatory /
   Mail / Mobile / Share Capital tabs all read-only and empty; footer text "Waiting for
   the client to fill and submit this step."; Today and the journey rail say "Waiting on
   the client…".
2. **Client submitted, NIC missing** — all client answers now visible read-only; notice
   "Priya Nair submitted their part. Fill the NIC codes, then submit to complete this
   step."; NIC fields empty with red "This field is required." after Submit; Submit button
   present; Today shows the step as "Day 1 · In progress" with CTA "Continue".
3. **Complete** — green tick everywhere, "Last edited by Sneha Kulkarni (Project Lead),
   21 Oct 2026, 6:40 pm", "Reopen step" button; the Draft Board Resolution step becomes
   current and the Documents pill reads "Documents 1 / 2".

Also show **Orchid Lane Foods** on Part B with pre-14 submitted by the client (lead sees
"The client submits this step. Nothing to add here.") and pre-7 as the lead's current step
with uploads.

## 18. Acceptance checklist (tick every line before you finish)

- [ ] Sidebar order, badges, Clients disclosure with INC/CMP tags, Compliances hidden
      until an incorporated company exists, pin modes, mini calendar.
- [ ] Top bar trail, Ctrl K palette with the four groups, both bells with their filters
      and empty states, theme toggle.
- [ ] Today: hero stats link to My work with `?focus=`, week strip filters the queue, queue
      pills and CTAs per kind, todos add/pin/done/remove, phase progress bars, managers,
      compliance health donut, waiting on.
- [ ] My work: List / Board / Timeline, URL filters, j / k / Enter.
- [ ] Engagement overview: CC chips editing with validation, four phase rows with tick
      tracks and "{done}/{total}", Documents pills.
- [ ] Step page: tab strip with ticks and red dots, Next → Submit, autosave states,
      journey rail scoped to the phase, attachments kebab, request-files panel, pre-2
      board-resolution card, Reopen step.
- [ ] **Client-intake rule**: lead cannot type client fields; sees nothing until the
      client submits; Submit replaced by the waiting line; NIC codes editable; errors
      "The client has not filled this yet."
- [ ] Authorized Signatory tab contains Passport, Driving Licence, Utility Bill; no
      Signatory KYC tab. Country / state pickers have a typing bar.
- [ ] Document pack chips, part filter, Preview pane, zip button disabled when nothing is
      ready.
- [ ] Board resolution editor banners, date line with "Change date", Send for manager
      approval confirm dialog.
- [ ] Email, Vault, Knowledge Bank, Announcements, Notifications, Compliances, Analytics,
      Audit, Settings as specified; every empty state present.
- [ ] Nothing in the lead portal lets the lead act for the client (no filling client
      intake fields, no approving on the client's behalf).
