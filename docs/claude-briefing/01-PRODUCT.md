# 01 — Product

## One-line

**VCFO Suite** is a multi-role web workspace for Indian professional-services firms that set up and run **GCC (Global Capability Centre) entities** in India — from client intake through MCA incorporation, post-incorporation hygiene, statutory registrations, FEMA reporting, and a recurring compliance calendar.

## Who it is for

| Audience | Job |
|---|---|
| **Firm** (CA / CS / VCFO boutique) | Run many client companies as **engagements** (projects). Assign Project Managers and Project Leads. Approve work. Keep an audit trail. |
| **Project Lead** (code role: `intern`) | Do the day-to-day checklist: forms, filings, document generation, manager approval, deliver to client. |
| **Project Manager** | Own a book of engagements, accept/reject lead work, email the client, see stuck projects. |
| **Firm Admin** | Firm-wide people, all projects, approvals, vault, knowledge bank. |
| **Super Admin** | Bird’s-eye; may enter every role shell to inspect. |
| **Client** (India subsidiary / parent-company contact) | Fill gated steps, upload KYC and signed docs, see what is waiting on them, invite teammates. |

Typical client story: a **foreign parent** wants an **India Private Limited** (or similar). The firm runs SPICe+ Part A (name) and Part B (incorporation), then post-inc (bank, capital, auditor, FC-GPR…), then GST/PF/ESI/IEC/etc., then ongoing GST/TDS/ROC filings.

## What “engagement” means

An **engagement** = one company setup project.

- Has a **company name**, legal form, domestic vs foreign, optional parent/subsidiary fields.
- Has **stage**: `Pre-Incorporation` | `Post-Incorporation` | `Operational Readiness` (the last is data-kept but **filtered out of primary UX**).
- Has **health**: `on-track` | `at-risk` | `overdue`.
- Stores the entire checklist in **`checklist_state` JSON** on the engagement row (not one DB row per step).
- Can start at Pre-Inc, or later stages (Registration / Compliance) if the India entity already exists — then subsidiary legal name/address are required.

People on an engagement:

- **Primary client** + extra clients (`engagement_clients`, owner/member)
- **Primary lead** + extra leads (`engagement_leads`)
- **Primary manager** + extra managers (`engagement_managers`)
- Optional **progress CC emails** (staff notify list; not the client Progress page)

## Product pillars (do not casually drop)

1. **Gated incorporation catalog** — ~34 active steps in 4 phases. Client waits; intern can open any step.
2. **Handoff loop** — client submit → lead work → request manager approval → manager Accept (compose to client) or reject/unlock.
3. **Document generation** — board resolution (docx), DIR-2 / incorporation pack, share to client, signed upload.
4. **Files** — milestone uploads to S3/MinIO; knowledge bank (staff); document vault; client documents.
5. **Compliance calendar** — obligations generate instances (Inngest job); staff + client views.
6. **Mail** — Resend for inbound client→staff process mail; Outlook Graph compose for staff→client.
7. **Audit + notifications** — in-app bell + audit log (scoped by role).

## What it is not

- Not a generic project-management tool (Asana). Tasks exist for admin/manager; intern Tasks was removed (redirects to Today).
- Not an MCA filing robot — leads still file on MCA / GST / RBI portals; the app tracks and collects.
- Not multi-tenant SaaS with separate firms in one DB as first-class orgs. One firm deployment; access is role + engagement membership.
- Not a client chat product. `/app/client/messages` is a **dead redirect**. Email is the conversation.

## Positioning / marketing copy today

Landing hero (`/`):

> VCFO Suite · GCC compliance cockpit  
> Engagements that feel precise — from intake to filing.  
> One workspace for GCC setup, client reviews, and firm approvals — built for Indian professional services.

Public pages: `/` (landing), `/roles`, `/contact`, `/login`, `/invite/[token]`.

## Origin

Re-platformed from **SBC-Track** (Supabase) to Postgres + Drizzle + Auth.js + S3. ~80% of domain/UI was **lifted unchanged**. New layer: `src/db`, `src/auth`, `src/storage`, `src/jobs`. Branding still uses some `SbcLogo` / `sbctrack.in` email From-domain names — a visual rebrand can rename chrome without touching those email domains unless you also change mail infra.

## Current maturity (pilot)

Built enough for a **10-person office-WiFi pilot**. Manual QA still listed as incomplete in `docs/context/TASKS.md`. Email without Resend/Outlook keys **console-skips**. Forgot-password is “ask your manager”. AWS Stage 2 is later.
