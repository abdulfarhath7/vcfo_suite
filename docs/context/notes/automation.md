# Automation wave 2 (IDEAS-PLAN A to F)

Gotchas for the six automation features built overnight on 2026-11-10 (commit 0562b79 on
`claude/dreamy-feynman-efzt1s`). The plan and the status table are in
`docs/specs/automation/IDEAS-PLAN.md`. Append when something costs more than a minute.

## Shared rules

- One migration, `0051_automation`, created all eight new tables (`request_lists`,
  `request_list_items`, `expiry_items`, `expiry_alerts`, `notice_cases`, `company_events`,
  `client_health_scores`, `sla_escalations`). `0056_remove_health_notices_events` drops the last
  four (C, D and E were removed on 2026-11-11). Both must be applied on RDS before deploy.
- The schema files (`src/db/schema-{request-lists,expiries,notices,compliance-events,client-health}.ts`)
  are re-exported from `src/db/schema.ts`. Repositories import from `@/db/schema`.
- Every page is one view for every staff role (and for the client where it applies). The route
  files under `app/app/<role>/...` only pass a `basePath`; `AuthContext` decides the rows.
- Approval tiers follow `docs/context/notes/ask-do.md`. T1 runs at once and changes nothing
  outside a private draft. T2 is a review card that changes the firm's own records. T3 is a
  review card that reaches a client and lists the recipients.
- Every job uses `withRunNow` and `skipWhenPaused` (`src/jobs/dev-controls.ts`), so it can be
  started from the developer console's Jobs page and stops while "Pause all jobs" is on. Each job
  is registered in `app/api/inngest/route.ts` and `src/lib/dev/jobs-registry.ts`.
- Email through `sendEmail` is the system of record. WhatsApp is used only by the request list
  reminders, and it is queued after the email so it can never block it.

## A. Client request lists

- **What it does.** A "please send" list for one client, started from a template (GST monthly,
  TDS quarterly, ROC annual, audit PBC, incorporation documents) or by hand. Items are a
  document, an answer or a confirmation. The client answers from the portal, and reminders run
  until every item is in.
- **Code.** Templates in `src/data/request-templates.ts`; rules in `src/lib/request-lists/`
  (`model.ts`, `emails.ts`); repository `src/db/repositories/request-lists.ts`; routes under
  `app/api/request-lists/`; one page `src/views/request-lists/RequestListsPage.tsx` at
  `/app/<role>/requests` for staff and `/app/client/requests` for the client.
- **Approval points.** `requests.createListFromTemplate` (T2) makes a draft. `requests.sendList`
  (T3) shows the exact recipients and the items, and nothing goes out until "Approve and send".
  The server runs the checks again at that click. The reminders follow from that one approval.
- **Job.** `request-list-reminders`, hourly (`0 * * * *`). It sends only between 09:00 and 18:59
  India time, every `cadence_days`, and at most eight times. WhatsApp joins from the second
  reminder for members who opted in. After the third reminder the lead gets one "call the
  client" task and a bell. A list completes on its own when every item is received.
- **Gotchas.**
  - A document item becomes an ordinary document request when the list is sent, so the client
    uploads it on the Documents page and the list reconciles item status from
    `document_requests` as it reads (`itemStatusFromDocumentRequest`).
  - An item counts as done once received, even before staff accept it, so reminders stop then.
  - A rejected upload maps to `cancelled` on the document request. The client cannot upload
    again until staff add a new item.
  - Opening a compliance period does not create its draft list yet, and the project page has no
    Requests tab yet.

## B. Expiry tracker

- **What it does.** One register of DSCs, DIR-3 KYC and registration renewals (GST, PF, ESI, PT,
  shops, FSSAI, trade licence, IEC, MSME, LEI, other), banded red (expired or 7 days or fewer),
  amber (within 30 days) and green. Since 2026-11-11 there is no Expiries page: the items show
  on every role's compliance calendar.
- **Where it shows.** The staff calendar (`ComplianceCalendarView`) marks each open item on its
  date (a hollow square, like a task), lists it in the day pop-up and the Excel export, and shows
  the `ExpiriesCard` in the rail: expired items and the next 90 days, with "Mark renewed" (and the
  new date) for every staff role. When the calendar has no company picker (a lead with one
  incorporated client), it still shows the expiries of every project in scope, so a lead sees
  the DSCs of projects still being incorporated. The client portal calendar draws expiries on
  their dates like tasks (`expiryAsRow` in `client-portal/pages/compliances/tasks.ts`, labelled
  "Expiry"; a click brings the rail card into view) and shows the same card, read only, even
  before incorporation. An area pick or the Non-statutory filter hides expiries. Links from
  alerts and My day open the calendar on the expiry's month (`?date=`).
- **Where the dates come from.** Part A or `pre-15` directors who already hold a DSC; KYC Review
  & DSC (`pre-7`) asks the expiry of each DSC the firm makes, beside its proof, and requires it;
  PF (`reg-1`) and ICEGATE (`reg-16`) ask whose DSC is registered on the portal and its expiry;
  the name approval expiry on `pre-5`; LEI (`reg-6`); Shops & Establishment (`reg-9`), Trade
  Licence (`reg-10`), Trademark (`reg-12`) and Trademark Renewal (`reg-17`, which replaces the
  `reg-12` date) ask theirs (optional); and the credentials workbook's reg rows. A `pre-7` date
  replaces the `pre-15` one for the same director; DSCs merge by holder name.
- **Name approval.** Kind `name_approval`, shown only until SPICe+ Part B (`pre-10`) is complete or
  the company is incorporated; the sync then deletes the item. It is in `CALENDAR_ONLY_KINDS`:
  no renewal alert, task, draft or email, and no "Mark renewed".
- **Code.** `src/lib/expiries/` (`model.ts`, `seed.ts`, `alerts.ts`); repository
  `src/db/repositories/expiry-items.ts`; routes `app/api/expiries/` (GET for the calendars, PATCH
  to mark renewed); card `src/components/compliances/ExpiriesCard.tsx`.
- **Sync on save.** `applyChecklistPatch` calls `syncExpiryItemsForEngagement` after a save of a
  step that feeds expiries (`stepFeedsExpiries`: `pre-1`, `pre-5`, `pre-7`, `pre-10`, `pre-12`,
  `pre-15` and every `reg-` step), so a typed date is on the calendar at once. It never throws;
  the nightly job catches up. Checked on 2026-11-11 against a local database: a DSC date saved
  through `POST /api/engagements/:id/checklist` moved the calendar item at once, and marking
  Part B complete removed the name approval item.
- **Approval points.** `registrations.setExpiry` (T2) adds or updates a date from Ask. The job
  never contacts a client: the draft client request it opens waits for a person to send it.
- **Job.** `expiry-alerts`, daily at 07:40 India time. It first seeds items from the checklist
  DSC answers, the credentials workbook "reg" rows and the current directors, then raises each
  stage that is due (T-60, T-30, T-7, expired): one renewal task for the lead, a draft request
  list, bells for the lead (and the manager at T-7 and on expiry) and the emails. The alert also says when a DSC lapses before an upcoming unfiled filing (read through `getFilings` as the lead).
- **Gotchas.**
  - The seed keeps dates set by hand. DIR-3 KYC items are inserted once and never synced, so a
    missed 30 September stays red; the next year's date comes only from "Mark renewed".
  - An LEI with only a registration date renews yearly from it (`leiNextExpiry`), so a lapsed LEI
    can show as current.
  - FSSAI dates only come in from Ask. There is no WhatsApp nudge for expiries.

- Backlog guard: an item that has never alerted and expired more than 30 days ago (`isExpiryBacklog` in `src/lib/expiries/model.ts`) is closed quietly at the expired stage by `systemListDueExpiryAlerts`. It opens no task, draft, bell or email; the calendar still shows it in red.
- A changed expiry date (by hand, from Ask, or from the backfill) clears `requestListId` with the alert stages, so the next cycle opens a fresh renewal draft.
- Clients read the register without `notes` and `requestListId`.
- `findExpiryItem` matches an exact name, else one unique whole-word prefix ("Ravi" finds "Ravi Kumar", not "Ravindra Singh"). Several matches, or a name with no Latin letters or digits, hold the `registrations.setExpiry` card. The card names the stored person whose date changes.

## C, D and E. Removed on 2026-11-11

The owner removed the notice desk (C), company events (D) and client health with the SLA ladder
(E). Migration `0056_remove_health_notices_events` drops `notice_cases`, `company_events`,
`client_health_scores` and `sla_escalations`. Company events are to come back as non-statutory
compliances. The Ask drop still reads a tax notice (`tax_notice`), files it in the vault's
Notices folder and keeps its values off the client's checklist. The older `compliance_events`
table of manual ROC and FEMA filings is a different thing and stays.

## F. My day

- **What it does.** A ranked plan per staff member: overdue, due today, approvals waiting,
  client replies, expiries and notices within seven days, and stalled request lists.
- **Code.** `src/lib/my-day/` (`gather.ts`, `rank.ts`, `email.ts`); repository
  `src/db/repositories/my-day.ts`; `GET /api/my-day`; card `src/views/my-day/MyDayCard.tsx` on
  every staff home, including the super admin overview; Ask tool `getMyDay`
  (`src/lib/ask/tools/my-day.ts`, `MY_DAY_TOOLS` in `src/lib/ask/pipeline.ts`).
- **Approval points.** None. It only reads, through the person's own scoped repositories.
- **Job.** `my-day-email`, weekdays at 08:40 India time, only for staff who turned on "My day
  email" in Settings (off by default), after their quiet hours. An empty plan sends nothing.
- **Gotchas.**
  - The card, the email and Ask share `rank.ts`, so change the order there and nowhere else.
  - A source that fails or refuses is left out and logged rather than failing the plan.
  - The admin's count of overdue filings is not capped, although the card shows the top eight.
