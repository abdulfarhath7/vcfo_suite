# Gaps: prototype features that need backend work

Each row is a prototype feature that the real tool does not show yet, because the data or
the service behind it does not exist. Nothing here is shown with made-up numbers.

| No. | Portal | Feature (prototype screen) | What is missing | What is needed |
|---|---|---|---|---|
| G-01 | Developer | The whole developer console: Overview, Connections, Messages, Jobs, Logs, Deploys, Access, Data and costs, Audit (`src/screens/dev/*`) | No developer role, no job runner store, no log store, no deploy history, no cost data. | A `developer` role in `profiles.role` and the auth guards; read models over `outlook_connections`, `notification_deliveries`, `email_send_log` and `audit_events` for Connections, Messages and Audit; an Inngest run history and App Runner deploy and CloudWatch log readers for Jobs, Deploys and Logs; an AWS Cost Explorer reader for Data and costs. |
| G-02 | Admin, super admin | Firm settings (`FirmSettingsScreen.tsx`, `super/SettingsScreen.tsx`) | No firm-level settings table (firm name, logo, working days, holidays, default reminders). | A `firm_settings` table and repository, an admin and super-admin route, and an audit event on each change (R-40). |
| G-03 | Client | Compliance proof upload by the client (Filings, obligation record) | `addFilingProof` is staff-only. | A client-scoped repository permission and a client route for proof upload. |
| G-04 | Client, staff | Obligation "About", "Why it applies", "If filed late" texts | Only `penalty_risk` reaches the screens; `applicability_note` and `due_rule` are not exposed. | A scoped read of those `compliance_obligations` columns, and text for each obligation. |
| G-05 | Client, staff | Registration certificate download, renewals and expiry | No signed-URL route on the credentials data; no expiry dates stored. | A signed-URL route on the credentials repository; expiry and renewal fields per registration. |
| G-06 | Staff | Registration numbers on the staff Registrations list | The slim checklist index drops step answers, so numbers show only on the item page. | A slim, scoped read of registration numbers across engagements. |
| G-07 | Client | Company IDs: DIN rows and the reveal countdown | `ClientHome.identifiers` has no DINs; the reveal store does not expose its expiry. | DINs in the home read; the reveal expiry time in the reveal response. |
| G-08 | Client | Withdraw a timeline change request | Only the manager approve/reject route exists. | A client withdraw route. |
| G-09 | Client | Multi-file upload from Home; "Message the lead" | The backend takes one file per request; there is no client-to-lead messaging. | A multi-file request upload; a messaging store and route. |
| G-10 | Client | "Copied from step n" pre-fill note; sub-step progress | Not recorded in the step model. | Fields on the step answers. |
| G-11 | Lead | Inbox "Triage" tab | No store of incoming client messages. | A client message store. |
| G-12 | Manager | "Assign task" to a lead | `TaskInstance` has no title; no assign flow. | A `title` field on tasks and an assign dialog posting to `/api/tasks`. |
| G-13 | Admin, super admin | Practice cards' stage splits, average days in stage, expected COI, "days in step" | No per-step opened-at timestamp, no step due dates, no expected COI field. | `opened_at` and `due_on` per step; an expected COI date per engagement. |
| G-14 | Admin, manager, super admin | Managers grid: On time %, Load, Last active, capacity | No on-time history, capacity setting or last-seen time. | A stored filed-against-due history, a capacity field and a last-seen timestamp. |
| G-15 | Lead, super admin | One-click "Remind" to the client from Waiting on and Risks | No send-reminder endpoint for steps. It still opens Mail. | A reminder route on the notify path (email first, WhatsApp additive). |
| G-16 | Lead | Task drawer: sessions and timer, checklist, files, activity, "Mark done" | Work items carry none of these; steps complete only through their forms. | Per-task session, checklist and activity data; a direct-complete action where the checklist allows it. |
| G-17 | Lead | Work planner: "Plan my week", calendar time blocks, "New to-do", request a change to manager-set dates | No time-block store; change requests exist per project, not per item. | A time-block store; an item-window change-request route. `use-personal-todos` could feed a to-do card now. |
| G-18 | Admin | Work "Managers" tab; reassign a task from the Leads list | No firm-wide feed of manager items; no reassign endpoint. | A firm-wide manager item read; a reassign route. |
| G-19 | Staff | Client record tabs Registrations, Obligations, Notes, Fees | The staff record view loads no data for them; notes and fees have no backend. | Wire the new Registrations and Obligations views into the record; a notes store. Fees stay out of dashboards (R-37). |
| G-20 | Super admin | Admin column, admins table, escalations; Assign client, Reassign, Assign task; notes | No admin-to-manager link, escalation store or notes store; the super surface is read-only. | Those links and stores, and write routes. |
| G-21 | Super admin | Growth sales pipeline, prospects, win rate; saved reports, schedules, PDF | No CRM store, report store or scheduler. Print stands in for the PDF. | A CRM store; a report store and scheduler. |
| G-22 | Super admin | "Not needed" on the record's Registrations tab | `SuperJourneyStep` has no raw status, so a not-applicable step reads Done there. | Add the raw status to `SuperJourneyStep` in `src/lib/super/`. |
| G-23 | Staff | Email signature line (K-40), attachments, group recipients | `/api/outlook` returns only `connected` and `msEmail`; `/api/outlook/send` takes no files; no mail groups. | A signature flag on `outlook_connections`; attachments on send; mail groups in the directory. |
| G-24 | Staff | "Helpful?" vote on staff answers | `/api/client/portal/feedback` is for clients only. | A staff feedback route (`recordAnswerFeedback` already works for any user). |
| G-25 | Staff | Profile notifications (channels, quiet hours, digest), two-step verification, device sign-out | No per-user store or backend. | A notification-prefs store for staff; 2FA and session management in Auth.js. |
| G-26 | Staff | Vault ZIP download, upload, requested files, review status, inline preview | No zip route; the vault has no upload, request or review data; no preview route. | A zip route; vault upload and request data; a preview route or a CSP for signed S3 URLs. |
| G-27 | Staff | Analytics completion rate, filing delay, filings on time, time in step | Needs the filed-against-due history and step start dates (G-13, G-14). | As G-13 and G-14. |
| G-28 | Staff | Audit "Result" column and "Load older" | No result field on `audit_events`; the API is fixed at 200 rows. | A result field; a cursor on the audit route. |
| G-29 | Admin | Admin Today practice cards (Registrations in progress against pending) | No per-step in-progress against pending split for registrations. | That split in the registrations read. |
| G-30 | Public | Landing click-through to demo portals; "Book a demo" | No public demo portals; `/contact` opens a `mailto:`. | Demo portals or screenshots only (owner choice); a demo-request route with email. |
