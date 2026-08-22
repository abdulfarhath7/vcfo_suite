# Repository layer — the seam

This folder is the **only** code allowed to touch the database. Views, domain
logic, and API routes call these functions; they never import `db` directly.

## The rule for every repository

1. Take an `AuthContext` (from `src/auth/guards.ts`) as the first argument.
2. Branch on `ctx.role` and filter by the scoping keys — reproducing the old
   Postgres RLS policy for that table (see `MIGRATION.md` for the exact policies).
3. Add a test asserting cross-tenant access returns nothing.

`engagements.ts` is the reference implementation. Copy its shape.

## Access-control rules ported from RLS (Path A)

Verified against the original SQL during Phase 1. Two rows in the first draft
of this table were WRONG and have been corrected — the SQL is the spec, not
this table, so re-check the migration before trusting a row.

| Table | Admin | Manager | Intern | Client | Source migration |
|---|---|---|---|---|---|
| engagements | all | `manager_id = ctx.userId` (legacy: `manager_id` null + `admin_id = ctx.userId`) | `intern_id = ctx.internId` | `client_user_id = ctx.userId OR client_id = ctx.clientId` | four-role + `20260522120000` |
| engagement_board_resolutions | all | via owned engagement | read + insert via assigned engagement; update only while `status = 'draft'` | read via own engagement | `20260525200000_board_resolution.sql` |
| knowledge_bank_files | all | all | **read all** + insert own (`uploaded_by = self`) | **none** | `20260529160000_knowledge_bank.sql` |
| compliance_obligations | all | all | read | read | `20260708120000_compliance_calendar.sql` |
| compliance_instances / _events / _triggers | all | via owned engagement | write via assigned engagement | read-only via own engagement | `20260708120000`, `20260805130000` |
| audit_events | **read: all** | **read: owned engagements** | none | none | four-role + `20260529120000` |
| email_send_log | read | read | none | none | `20260806120000_email_send_log_seeds.sql` |

Corrections from the first draft:

- **knowledge_bank_files** has no `visible_to_roles` column. Interns can read
  every file and insert their own; clients get nothing at all.
- **audit_events** is manager-read-only — interns do *not* see the trail for
  their assigned engagements. Inserts are allowed for any authenticated user
  but the row's `actor_user_id` is forced to the session user.

`documents`, `tasks`, `document_requests`, `invites`, `activity`,
`notifications`, `outlook_connections`, and `announcements` have no original SQL (they are new, replacing localStorage),
so their rules are a product decision rather than a port. Default to:
admin all, manager via owned engagements, intern via assigned engagement,
client via own engagement. Documents additionally hide non-shared rows from
clients (`shared_with_client = true` only). `GET /api/documents` without
`engagementId` is the staff vault list — same Path A scope; intern cannot see
another intern’s client files. Notifications stay per-user
(`user_id = ctx.userId`); admin/manager may create for another user.
`outlook_connections` is the signed-in staff user's own Microsoft mailbox
(Graph Mail.Send); clients have no access. `email-directory` lists Outlook
compose recipients from the same engagement scope (+ intern reports-to).
`email_templates` is firm-scoped compose library (SBC branded vs plain):
staff list/create; admin/manager mutate any; intern mutate own; client none.
`announcements` is firm-wide news (not the notification bell): every signed-in
role may read; super_admin / admin / manager may post and delete. Author name
is stored on the row. `announcement_sources` are official RSS/Atom URLs
(allowlisted hosts); Inngest `announcement-feeds` pulls them once each morning IST.
Do not HTML-scrape homepages or login pages. System ingest:
`systemListEnabledAnnouncementSources` / `systemUpsertFeedAnnouncements` /
`systemGetOrCreateAnnouncementSource` (only after a catalog URL parses as a feed)
— job-only, no AuthContext.

Implemented: `engagements`, `knowledge-bank`, `profiles`, `audit-events`,
`board-resolution`, `compliance`, `documents`, `tasks`, `document-requests`,
`invites`, `activity`, `notifications`, `outlook-connections`, `email-directory`,
`email-templates`, `announcements`.

System jobs (Inngest): `systemGenerateComplianceInstances` /
`runComplianceGenerate` in `compliance.ts`, and feed ingest helpers in
`announcements.ts`, may touch `db` without AuthContext. Routes still must
not import `db`. Staff “Pull now” goes through `ingestAnnouncementSource`.