# xfix-super: super admin sidebar, Team, Reports, Firm settings and super reach (✗ rows, 30 Oct)

## Super admin sidebar

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-129 | ✓ | Risks now shows its count: the same list the Risks page builds (`buildRisks` over `/api/super/insights`), plain (not red), on the open sidebar and on the stacked rail. Clients already showed `engagements.length` through the fold row. New `src/components/super/parts/SuperRisksCount.tsx`, wired in the super admin branch of `RoleSidebar.tsx` only. |
| P-130 | ✓ (stale) | Already built: `SidebarFoldRow` with `ClientsFoldBody` (`StaffSidebarFolds.tsx`) gives super admin the client fold with identity square, short name, Inc/Cmp pill, the open client and "View all N", with a fold button. |
| P-131 | ✓ (stale) | Already built: `PeopleFoldBody` lists managers with initials and "N clients" from `/api/shell/sidebar`, with a fold button; rows open the Team page, as in the prototype. |
| P-136 | ✓ (stale) | `/app/super/vault` ("Documents" in the super sidebar) is the shared explorer for every client (`DocumentVaultPage`). The record's own Documents tab stays; a link from the record and step page to the vault belongs to the record agent (`SuperProjectDetail.tsx` is not mine). |

## Team

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-189 | ✓ | New "Reassign" rail card (`SuperReassignCard`, Repeat icon, violet). Suggestions come from a tested rule (`reassign-model.ts`): a client with no manager goes to the manager with the most room (capacity less open, under 80%; fewest clients when no capacity is set), a client with no project lead goes to that manager's lightest lead ("Due 18 Oct" from the current step when known), and a manager over 80% hands their lightest client to the lowest manager under 70%. Each row: client, "from to · why", Assign or Reassign (saves through `/api/super/assign`, which audits and emails), then a Done chip and the A2 Undo toast. Undo is offered when there was someone to go back to (the assign route cannot unassign). Dashed "Nothing to move" when empty. |

## Reports

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-223 | ✗ | Owner decision R-37 still holds: no money in the tool. The fees, outstanding and late-fee report is not built, and no fee rows were added anywhere. |
| P-225 | ✓ | The Save report dialog has a Format select: "PDF" or "Excel (CSV)". There is no XLSX package and no dependency may be added, so Excel gets a UTF-8 CSV with a byte-order mark that Excel opens (formula-looking cells are defused). The format is stored in `saved_reports.params.format` (jsonb, no schema change). Saved rows download in their format, and the scheduled email attaches the CSV for those reports. New routes `/api/super/reports/csv` and `/api/super/reports/[id]/csv`. |

## Firm settings

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-231 | ✓ | "People and roles" grid with count: Name with email, Role chip (Super admin, Admin, Manager, Project lead, Developer), Reports to (lead to manager, manager to admin). Primary "Add person" in the head. Data: `/api/admin/people` and the reporting lines (firm-wide admins). |
| P-232 | ✓ | "Add person" dialog: Name, Work email, Role (Admin, Manager, Project lead), Reports to (manager for a lead, required; admin for a manager). Creates the account through the same `POST /api/admin/people` as the People page, then sets a manager's admin through `/api/admin/people/reporting`. The button says "Add person", not "Send invite": staff accounts get the temporary password (shown in the toast); no invite email exists for staff. |
| P-236 | ◐ | "Roles and permissions" grid (KeyRound, violet): Can view, Can edit, Can approve per role, Super admin row locked. Stored in new `firm_settings.role_permissions`, saved through `/api/firm-settings` with an audit event ("Role Manager can approve off"), shown in Settings history. Only the super admin may change it (repository refuses an admin, tested); firm admins see it read-only. The defaults are what the code allows today. Not yet enforced: the step review and edit routes still check roles in code. `systemGetRolePermissions()` and `roleCan()` are ready for those routes (request below). |
| P-237 | ✓ | Inline caution strip (R-40) `ConfirmRow`: "Give or Remove "can X" to/from Role?" with Cancel and the action on Roles and permissions, and "Disconnect Outlook mail (mailbox)?" on Integrations. |
| P-238 | ✓ | "Service targets" card (Target, teal) with Edit / Done and label-value rows: days to COI, file returns N days ahead, reply within N working hours, escalate after N days, partner report day of month. Stored in new `firm_settings.service_targets`, validated (whole numbers, report day 1 to 28), audited per change. Unset targets read "Not set". |
| P-241 | ✓ | "Integrations" list (Plug, info tone): Email, Outlook mail, WhatsApp, File storage, Background jobs, Ask VCFO, each with provider and a status chip (Connected, Needs set-up, Not set up) from env presence through new `GET /api/firm-settings/integrations` (words only, no env names). Outlook adds the viewer's own link: "Needs sign-in" with Sign in (`/api/outlook/connect`), or Connected with the mailbox and Disconnect (asks first). Services not set up give the super admin a "Set up" link to the developer console's Connections page. The prototype's government portals (MCA, GST, EPFO, DigiLocker) are not listed: the app has no connection to them. |

## Shared screens

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-639 | ✓ | Profile › Notifications for the super admin now has "Escalations" (already there) and a new "Monthly partner report" switch. It is a new staff alert key `partnerReport` (default on) in the `notification_prefs.email` jsonb, so no schema change. Off holds the person's own monthly scheduled partner reports: the `saved-reports-send` job skips them. |

## Files changed
- src/components/shell/RoleSidebar.tsx: Risks count on the super admin's Risks row only.
- src/components/super/parts/SuperRisksCount.tsx (new): the Risks count badges.
- src/components/super/insights/reassign-model.ts and reassign-model.test.ts (new): the suggestion rule.
- src/components/super/overview/SuperReassignCard.tsx (new): the Reassign card.
- src/views/super/SuperTeam.tsx: the Reassign card in the rail.
- src/components/super/reports/SaveReportDialog.tsx: Format select.
- src/components/super/reports/SavedReportsCard.tsx: download in the saved format.
- src/lib/reports/partner-report.ts: `format` in the params, `REPORT_FORMATS`, `REPORT_FORMAT_LABEL`; `partnerParams` keeps csv only.
- src/lib/reports/partner-report.test.ts: format test.
- src/lib/reports/saved-report-schema.ts: optional `format` in the params.
- src/lib/reports/partner-report-csv.ts and partner-report-csv.test.ts (new): the CSV builder.
- src/lib/reports/render-partner-report.ts: `renderPartnerReportCsv`.
- src/jobs/saved-reports-send.ts: CSV attachment for CSV reports; hold monthly reports when the owner switched the partner report off.
- app/api/super/reports/csv/route.ts, app/api/super/reports/[id]/csv/route.ts (new).
- src/db/schema-firm.ts: two columns (below).
- src/lib/firm-settings/firm-settings.ts: service targets and role permissions (types, defaults, readers, words, patch schema, audit lines, `roleCan`).
- src/lib/firm-settings/firm-settings.test.ts: tests for the above.
- src/lib/firm-settings/integrations.ts and integrations.test.ts (new): the firm-facing integrations list.
- src/db/repositories/firm-settings.ts: reads the new columns, refuses role-permission changes from anyone but the super admin, `systemGetRolePermissions`.
- src/db/repositories/firm-settings.test.ts: cross-role tests for targets and permissions.
- app/api/firm-settings/integrations/route.ts (new).
- src/views/firm-settings/sections-extra.tsx (new): People and roles, Add person, Roles and permissions, Service targets, Integrations, ConfirmRow.
- src/views/firm-settings/FirmSettings.tsx: the new cards in the prototype's order.
- src/lib/client-portal/notification-prefs.ts: `partnerReport` staff alert.
- src/db/repositories/notification-prefs.test.ts: the alerts expectation includes `partnerReport`.
- src/views/settings/account/NotificationsCard.tsx: the super admin's "Monthly partner report" row.

## New routes
- `GET /api/firm-settings/integrations` (super admin and admin).
- `GET /api/super/reports/csv?month=` and `GET /api/super/reports/:id/csv` (super admin).

## Schema added
In `src/db/schema-firm.ts`, table `firm_settings`:
- `service_targets jsonb NOT NULL DEFAULT '{}'`: the five service targets (P-238).
- `role_permissions jsonb NOT NULL DEFAULT '{}'`: the role permission grid; empty means the code defaults (P-236).

The repository selects the whole `firm_settings` row, so Firm settings and the logo route fail until migration 0029 adds these two columns.

## Env vars
None.

## Requests
- Hub: migration 0029 for the two `firm_settings` columns above.
- Route owners (step review and approve routes, for example `app/api/engagements/[id]/checklist/review`, `app/api/documents/review`): call `systemGetRolePermissions()` and `roleCan(perms, ctx.role, 'approve' | 'edit')` so the Roles and permissions grid takes effect (P-236 stays ◐ until then).
- Record agent: a "Documents" link from the super record and step page to `/app/super/vault` (P-136).
- Overview owner: "· target N" on the Incorporation card (P-021) can now read `settings.serviceTargets.daysToCoi` from `/api/firm-settings`.

## Decisions
- "Excel" is a CSV that Excel opens, not XLSX (no package, no new dependency).
- Only the super admin changes role permissions; firm admins see the grid read-only.
- Add person keeps the People page's account flow (temporary password); the button says "Add person" because no invite email is sent to staff.
- Integrations list only services the app really uses; government portals are left out.
- Reassign Undo is offered only when there was a previous person, because `/api/super/assign` cannot clear a manager or lead.
- The "Monthly partner report" switch holds the person's monthly scheduled reports; weekly schedules are not affected.

## Checks
- `npx tsc --noEmit -p .`: clean (whole project, 30 Oct).
- `npx eslint` on every file above: 0 errors, 3 warnings (existing, in super files).
- `npx vitest run` on src/lib/firm-settings, src/db/repositories/{firm-settings,notification-prefs,saved-reports}.test.ts, src/lib/reports, src/components/super, src/lib/client-portal, src/views/settings, src/views/super, src/components/shell: all pass. One failure in `src/lib/dev/dev-lib.test.ts` (`runEvent` field in the Inngest parse) is in another agent's files and not caused by this work.
