# Lead portal redesign — plan (approved by owner 2026-10-16)

Lead = code role `intern`. Owner said: design everything in a canvas, no approvals, fake data only.

## Rules
1. The client dashboard is FROZEN. Design source = `docs/specs/client-pages/prototype/vcfo-client-portal-FINAL.html`
   (owner's final copy). Take its look: colours, cards, icons (option 4 = Lucide coloured line in a 32 px tinted
   tile), greeting card, timeline, calendar (grid lines between dates, whole-box highlighted today),
   before/after switch, compact contacts, smiling avatar chat, new logo, responsive at all sizes.
2. Feature source = this repo (`app/app/intern/**`, `src/views/intern`, `src/components/intern`). Every existing
   Lead feature stays. Remove nothing.
3. New features are marked NEW.
4. Already approved Lead designs: S1 layout + client colours + greeting card; owner's compliance health design;
   phase progress = owner's 2nd screenshot. Week strip = option 3. Clients pages = option 1 each.
   (See Design 7 session canvases for these.)
5. Decisions taken with defaults: add the smiling avatar chat for Leads; keep Board view in Work; week strip option 3.

## Pages (existing features → new look)
| Page | Keep (repo) | New look / NEW |
|---|---|---|
| Today | KPI tiles (Action, Overdue, Waiting, This week); week strip with day filter; action queue grouped by company with CTAs (Open step, Review, Deliver, Continue, Email manager again, Send reminder); personal Todos (type, pin from queue, filter, done, remove); phase progress (Registration, Part A, Part B); managers card with Email; compliance health (filed/overdue/due soon/upcoming + next 2); Waiting on (top 5) | Greeting card + KPIs; NEW All · Incorporating · Compliance switch with counts; NEW Ball in court (Me / Client / MCA) + Nudge; NEW triage inbox (Make task · Done · Snooze); NEW daily digest; client health table with step tracker |
| Work | List / Board / Timeline views; filters (company, Steps+filings/Steps/Filings, day chip); j/Enter keys; count badge | Timeline on top (client style); To-do with headings: Assigned by manager / My to-dos / Recurring this month; Google-Calendar-style Day/Week/Month; NEW drag to-do → calendar time block in client colour; NEW one task, three views (to-do item, timeline span, calendar work sessions; done anywhere = done everywhere; tasks created only in To-do); NEW manager dates locked + Request change; NEW amber warning when a block is outside the span; NEW drag own to-do to timeline; NEW compliance due dates as read-only all-day items; NEW Plan my week; NEW templates/recurring; NEW Waiting on client + Nudge; NEW task drawer; NEW export |
| Clients | Company cards (stage, ring, %); sidebar company list | Clients page option 1 designs |
| Engagement overview | Phase tabs with counts, phase cards, CC emails, doc-pack pills, client mailto | Client incorporation pages ("As in VCFO Suite"), ring, Days to COI |
| Step page | Forms (Filed / To file), Activity, journey rail, What's this?, Request manager approval, Request client fill, uploads, Mark all complete | Client step layout + What's this? drawer |
| Documents (doc pack) | Part A / Part B filter, preview, zip download | Client documents style |
| Board resolution editor | Edit, preview, Save, Apply template, Finalize, Send to client | Client colours/icons |
| Email | Outlook send, recipient picker, templates | Client card style |
| Vault / Knowledge Bank | Search, group by client, folders, upload, new folder | Client documents style |
| Announcements / Notifications | Read list; history filters (All/Received/Sent, Today/This week/Earlier) | Client notifications page, option 4 icons |
| Compliances Calendar / Filings | Only after COI; month grid, act legend, company picker; filings register with all filters | Client compliance calendar + filings table |
| Analytics / Audit | 4 stats, 2 charts; audit tabs, filters, expanding rows | Client card/table style |
| Settings | Profile, WhatsApp opt-in, password, Outlook | Client settings style |
| Shell | Sidebar (Today, Work, Clients, Email, Docs, Updates, Compliances, Analytics, Audit), breadcrumbs, search palette, 2 bells, theme toggle | Client top bar, new logo, option 4 icons |

## Before / after incorporation (per client)
- Before COI: phase tracker, Days to COI, stuck steps, phase bars in timeline.
- At COI: client moves to Compliance automatically; Compliances menu appears; one-time "Incorporated" note.
- After COI: client × filing grid, donut, due dates in calendar.
- Preview switch on every page: All incorporating · Mixed · All compliance.

## Order
1. Today  2. Work  3. Other pages in table order. Canvas only. No HTML prototype until the owner asks.
