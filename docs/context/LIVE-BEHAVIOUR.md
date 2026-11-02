# Live behaviour that looks wrong — for the owner to decide

The owner's rule (2026-10-29): the new portals copy every operation of the live tool (`origin/main`,
app.sbctrack.in) exactly, even where it looks wrong, and the owner fixes those afterwards on localhost.
The agents porting each page list what looked wrong here. Nothing below has been changed yet unless a line
says so. Paths are as of branch `portal-redesign`.

## Manager — Today (dashboard)

1. **"Approvals to send" and "overdue" tiles are always 0.** `src/views/admin/Dashboard.tsx` counts tasks with
   status `awaiting-client` / `overdue`, but `src/db/repositories/tasks.ts` stores both as `open` and reads
   `open` back as `not-started`.
2. **"Upcoming filings" shows the oldest filings, not upcoming ones.** `Dashboard.tsx` (`dueSoon`) and
   `DashboardSecondaryRow.tsx` filter `nextDue − now < 14 days` with no lower bound and no status filter,
   sorted oldest first, so filed ones show too. It also computes filings in the browser
   (`computeAllFilings`) instead of reading the register the Calendar uses, so the two can disagree.
3. **"Process" and "By project" percentages come from free-form team tasks, not checklist steps**, so phases
   mostly read 0% (`Dashboard.tsx` `portfolioPhases`, `tasksByEngagement`).
4. **The dashboard's "approvals received" can disagree with the Approvals inbox.** The dashboard counts
   Operational Readiness projects and leaves out send-to-client requests; `src/lib/pending-approvals.ts` does
   the opposite.
5. **"By project" lead names are blank for leads who report to another manager.** `DashboardSections.tsx`
   looks up the roster, which `listInternOptions` scopes to the manager's own reports. (The new Today uses
   `GET /api/engagements/leads` for the whole book.)
6. **A client with overdue filings can still count as on track.** The "at risk" tile reads stored
   `engagements.health`, which is set once at creation and only changed by hand (Solstice: 4 overdue filings,
   still `on-track`).
7. **Deleted to-dos can come back.** `src/lib/use-personal-todos.ts` re-uploads browser-cached to-dos that are
   missing on the server, so one deleted on another device returns.
8. *(branch work, not live)* `regulatory.approved` notifications send managers to `/app/admin/announcements`,
   an admin route (`src/lib/regulatory/notify.ts:137`).

## Manager — Clients, client overview, step page, documents, project form

1. **"Request files from the client" never renders.** `ClientFileRequestsPanel` reads `item.fields`, which no
   catalog item sets; the fields come from `getClientResponseFields`, and the API accepts them. One-line fix
   in both places: use `getClientResponseFields(item)`.
2. **The Projects list hides Operational Readiness projects** but its subtitle counts all engagements. (The
   console lists them in a separate panel instead of dropping them silently.)
3. **The list's progress % comes from the `tasks` table**, while the project page counts checklist steps, so
   the two can disagree.
4. **Stored `engagements.health` is only ever set to on-track**, so the Health column always reads On track.
5. **The project timeline uses the client viewer**, so staff see "Waiting for you". (The console says
   "Waiting on the client".)
6. **The checklist POST route never strips a manager's writes on direct-flow steps**, although the domain rule
   says managers only read them; such a write is also stamped "(Project Lead)".
7. **The step-page redirect drops `?tab=`.** (The console keeps it.)
8. **"Pre-7" means two things:** live copy uses it for catalog id `pre-7` (KYC Review & DSC); the prototype's
   position code Pre-7 is Registered Office Address. The console uses position codes and step titles in prose.

## Manager and lead — Email, Document vault, Knowledge bank

1. **Email: the Client picker keeps the last client after Send** while To is empty; picking the same client
   again does nothing (`ComposeRecipientPicker`). Only Discard resets it.
2. **Email: `?to=` is dropped when the directory request fails**, even for a valid address (`ComposeMail`).
3. **Email: raw error codes** such as `outlook_not_configured` reach the person as text (`/api/outlook/send`).
   (The console puts plain wording in front of three codes.)
4. **Vault: choosing a client during a search has no visible effect** (`DocumentVaultPage`).
5. **Vault: reloads every engagement's checklist on every visit**, one request per engagement.
6. **Vault: requested a signed link for every card as it rendered.** (The console asks only on Preview / Open.)
7. **Knowledge bank: "Download" opens the signed link in a new tab**, so PDFs open instead of saving; the list
   loads only the 200 newest files (`listKnowledgeBankLibrary(ctx, 200)`).
8. **Knowledge bank: super admin sees Delete but the API rejects the role** (`requireAnyRole('admin',
   'manager','intern')` vs the page's `isAdminOrManager`).

## Updates — bells, Announcements, Notifications, Regulatory updates, Ask VCFO

1. **`src/lib/regulatory/notify.ts:137` links every staff member, leads included, to `/app/admin/announcements`.**
   The console remaps it onto the current seat; the stored link is still wrong.
2. **The bell count also counts unread "email sent" confirmations** (`unreadNotificationCount`), so it can be
   higher than the Unread list (received only).
3. **Staff announcement read marks live in `localStorage`**, so reading on one machine leaves it unread on
   another. The client portal already stores reads on the server (`/api/client/announcements/reads`).
4. **Any manager can delete any announcement**, including admins' posts and approved official updates
   (`deleteAnnouncement` has no author check); live deleted in one click. (The console asks to confirm.)
5. **Approve on a regulatory update published it and emailed every client with no confirmation.** (The console
   asks to confirm.)
6. **Managers see "check with your lead" on Ask VCFO answers** (shared `TrustBadge` copy).
7. **The notification history page missed new notifications until its own query refreshed.** (The console
   merges in the live inbox.)

## Manager — Approvals and Date requests

1. **Registration steps never reach Approvals or Today.** `src/lib/pending-approvals.ts` looks only at pre- and
   post-incorporation steps.
2. **Rejecting a lead's request tells the client** ("Corrections requested" notification, client email draft)
   because it uses the client-submission path (`reviewChecklistItem` + `review_rejected` rules).
3. **Approving a board resolution never opens the client email**: `approveBoardResolutionInDb` drops the email
   the finalize route builds.
4. **Timeline (date) decisions notify nobody**, and the "Note to the client" is saved but never shown to them.
5. **Co-managers don't see approvals** in the inbox (main manager only), though they can decide on the step page.
6. **Today's date-request count includes only incorporating clients**; the sidebar badge counts the whole book.
7. *(console, not live)* Today writes step codes from the step id ("Pre-13"); the Clients chain and Approvals
   use the step's position. To align in the integration pass.

## Manager and lead — Compliance calendar and Filings register

1. **Filings could never become filed**: no route wrote `filed_on`, so a row with proof uploaded stayed Overdue.
   (The console adds Mark filed: `POST /api/filings/[id]/filed`, managers / admins on their own clients, audited.)
2. **Three "due soon" thresholds**: staff views 14 days (`filings.ts`), client portal 7, console "Due this
   week" 7. (The console uses 7; 14 survives as "Coming up".)
3. **Changing FY on the monthly sheet is a dead end**: `?period=` is cleared, the month may fall outside the FY,
   the sheet is empty and both arrows are disabled.
4. **Leads can't upload proofs** in the UI although the API lets them.
5. **The WhatsApp nudge scan checks `status === 'filed'`** while everything else uses `filed_on`; older rows with
   only `filed_on` are still nudged.
6. **The calendar summary mixed scopes**: overdue counted the whole FY, "due this month" and "filed" the month.
7. *(branch only)* `CalendarLayoutStudio`'s `referenceMark` marks a hash-chosen fifth of past SBC deadlines as
   "Done" — invented status; not shipped in the console.
8. **The pre-COI notice promises instant generation**; the generator runs daily at 06:00.
9. **Leads see register rows of non-incorporated clients under All** although their roster lists only
   incorporated ones.

## Manager and lead — Analytics, Audit log, Settings

1. **Analytics "Waiting on client" and "Overdue steps" count only hand-set statuses**, ignoring lateness from
   date windows, so they can disagree with Today.
2. **Analytics "Steps completed %" counts every item not marked not-applicable**, including items that don't
   apply to that company type.
3. **Analytics charts were "Sample data".** (The console builds them from the filings register.)
4. **Audit role filter has no Admin / Super admin option**; their actions only show under "Everyone".
5. **Audit role labels disagree**: filter "Manager", badge "Project Manager".
6. **Audit By project tab fetches the log twice** when the project changes.
7. **WhatsApp consent text says "about my engagement"** (client wording) to staff too.
8. **Outlook "connected but no mailbox email" shows "Not connected" next to a Disconnect button.**
9. **The audit paging cursor (`created_at < before`) can skip events sharing a timestamp.** (The console sends
   oldest + 1 ms and drops repeats by id.)

## Project lead — Today, Reviews, Registrations, Team

1. **Lead Today computes filings in the browser** (`computeAllFilings`) instead of reading the register, so its
   counts can disagree with the Calendar. (The console reads the register.)
2. **A team task cannot be "Waiting on client"**: `tasks.ts` stores `awaiting-client` as `open` and reads it back
   as `not-started`.
3. **Document uploads have no review screen on live**: the Requests page redirects to My work and `approveDoc`
   has no caller, so clients see "In review" indefinitely; "Send back" is stored as `cancelled`, so the item
   disappears for the client with no note. (The console's Reviews page approves / sends back.)
4. **Live tells leads to review client submissions they cannot decide** ("Client submitted — review"), but
   `/checklist/review` allows managers and admins only.
5. **A pinned to-do is deleted when its work item leaves the queue** (the hook prunes it on the server too).

## Project lead — Clients, client page, step page, board resolution

1. **The lead list includes Operational Readiness projects while the manager's list hides them**, so the two
   seats list different sets for the same client.
2. **The progress-email CC list is editable only on the lead's overview**, although the API also accepts
   managers and admins.
3. **The CC route excludes `super_admin`**, so a super admin in the lead seat sees "Could not load".
4. **The lead project page has no send log, timeline requests or "What SBC is doing"**, so leads cannot see what
   was sent to their client.

## Manager and lead — My work, Project leads, Team load, lead Tasks

1. **Team page shows 0 open tasks and 0% load for every lead**: `src/views/admin/Team.tsx` compares a task's
   assignee (profile id) with the lead's scoping key, which never match; the load bar is "open ÷ 30".
2. **People page shows a truncated id as the manager** ("PM 3f2a91bc") for managers: `FirmPeople.tsx` loads the
   manager names for admins only.
3. **Managers can see every client account in the firm**: `listClientAccounts` / `listRemovedClients`
   (`src/db/repositories/profiles.ts`) are not limited to the manager's clients.
4. **Leads who report to no one appear on every manager's roster** and any manager can edit or delete them
   (`listInternOptions`, `updatePersonEmail`, `deleteProfileAccount`).
5. **A shared default temporary password, `SBC@2026`**, is set in `FirmPeople.tsx` and `/api/admin/people`.
6. **Team-task titles can't be edited and tasks can't be deleted** (`updateTask` ignores the title; no delete
   route).
7. **Tasks seeded at project creation probably never save**: `seedTasksFor` posts assignees `tm1`/`tm2`/`tm3`,
   not real profile ids, and the failure is ignored.
