# 03 — Feature map

Status: **built** unless marked thin / stub / deferred / dead.

## A. Public / marketing

| Feature | Where | Notes |
|---|---|---|
| Landing | `/` | Hero, problem, how-it-works, roles, impact, CTA. Cool blue aurora, grain, product plane mock. |
| Roles page | `/roles` | Role explainer. Audit noted large empty whitespace. |
| Contact | `/contact` | “Open email draft” pattern, not a ticket system. |
| Login | `/login` | Credentials + theme toggle. Best “colourful chips” pattern in the app. |
| Invite accept | `/invite/[token]` | Client/staff invite landing. |

## B. Engagement lifecycle

| Feature | Who | Notes |
|---|---|---|
| Create project + client account | Admin, Manager | `CreateProjectForm`. Company, type, legal form, parent/subsidiary, client contact/email/temp password, leads, managers, start stage. Draft persisted in localStorage until submit. |
| Project list | Admin all / Manager owned | Cards + health + stage. |
| Project detail | Admin, Manager | Team panel, activity, checklist entry, resend welcome. |
| Soft-delete / recycle | Admin | `deletedAt` on engagements. |
| Multi-client | Client owner | Invite peers `/app/client/team`. Substitute (self signs out). |
| Multi-lead / multi-manager | Staff | Membership tables. |
| Progress CC | Staff | Extra email CC for process mail; not a client nav item. |

## C. Incorporation checklist (core)

Catalog: `src/data/checklist.ts`. Persistence: `engagements.checklist_state` jsonb.

| Feature | Notes |
|---|---|
| 4 phases, ~34 active steps | See `06-DOMAIN-INCORPORATION.md`. |
| Sequential gate (client) | Previous **active catalog** item must be terminal (`completed` / `not-applicable` / client submit / deliver). Draft save does **not** unlock. Reject/unlock re-locks later steps. |
| Per-step forms | Fields: text, textarea, select, file, date; sections; `showWhen`; `filledBy` client vs intern. |
| Autosave (intern) | ~600ms debounce, `{ responses }` only. Must **not** email manager. |
| Submit / Save / Deliver | Role-specific footers. Intern: Request manager approval, Email manager again, Submit on last section tab. |
| Manager review | Accept → Graph compose to client (CC admin + lead). Reject / unlock for correction. |
| File uploads | Compact dropzone → `/api/engagements/:id/milestone-documents` → S3 prefix `milestone-documents/`. |
| Journey rail | Client: gated flowchart. Intern: **current intern phase only**. Admin/manager: left journey + right workspace rail. |
| Overdue badges | Only on current active/waiting step, never locked future. |

## D. Generated documents

| Feature | Notes |
|---|---|
| Board resolution | Pre-2. Generate from Pre-1 data, intern editor, **finalize** is the only release (`status=finalized`, unlocks Pre-3 signed upload, notifies client). Client cannot see drafts. |
| DIR-2 / incorporation pack | Pre-7 generate panel; share with client. |
| Docx preview | White page inside shell (dark-mode clash known). |
| Signed board resolution upload | Client Pre-3. |

## E. Collaboration / mail / notifications

| Feature | Notes |
|---|---|
| In-app notifications | Bell. Received/Sent tabs. Hard delete + 7s undo. |
| Process emails | `notifyEngagementEvent`. Client→lead uses Resend From `{company}@sbctrack.in`, Reply-To client. Lead→client prefers Outlook Graph compose. |
| Staff compose | `/app/{intern\|manager\|admin}/mail`. To chips, Team + Client filters, templates (`sbc` branded vs `plain`). |
| Outlook connect | Settings / `/api/outlook/connect`. Not an Auth.js login. Tokens encrypted with `AUTH_SECRET`. |
| Document requests | Intern Requests; client Inbox groups pending by due (today / this week / later). |
| Activity feed | Staff project activity panel. |
| Welcome email | On client create / substitute. Console-skip without API key. |

## F. Compliance

| Feature | Notes |
|---|---|
| Obligation catalog | `src/data/compliance.ts` + DB `compliance_obligations`. |
| Instance generation | Inngest job `src/jobs/compliance-generate.ts`. System path, no AuthContext. |
| Staff calendar | `/app/{admin\|manager\|intern}/compliance`. |
| Client compliances | `/app/client/compliances`. |
| Sidebar mini | `SidebarComplianceMini` on staff nav. |
| Email digest | **Deferred** — job mostly console-logs today. |

## G. Firm ops

| Feature | Notes |
|---|---|
| People | Admin `/app/admin/people`. Create/list staff; generated IDs sometimes shown (UX issue). |
| Project leads roster | Manager `/app/manager/team`. |
| Approvals inbox | Work waiting manager/admin (`project-stuck` helper). Empty state weak. |
| Doc vault | Staff documents store. |
| Knowledge bank | Staff file library. Clients: none. |
| Analytics | Charts exist; **hardcoded demo series** in places — trust risk. Do not treat as real BI. |
| Audit log | Admin/manager firm/owned; client scoped `/app/client/audit`. |
| Account settings | Change password (+ Outlook for staff). No notification/appearance prefs beyond TopBar theme. |
| Command palette | ⌘K / Ctrl+K. Only type-in search. Sidebar search is a button that opens this. |

## H. Super Admin

Overview KPIs (total / attention / on-track, skipping Operational Readiness) + launchers into other shells.

## I. Intentionally thin, deferred, or dead

| Item | Reality |
|---|---|
| Operational Readiness | Stage exists in DB; **filtered from primary nav/queues**. |
| Client Progress nav | **Removed**. `/app/client/progress` redirects to Incorporation flowchart. |
| Intern Tasks | **Removed**. `/app/intern/tasks` → Today. |
| Client Messages | **Dead redirect**. Do not design a chat here without a real backend. |
| Intern phase tabs | Flag `INTERN_PHASE_TABS_ENABLED` currently **off**; overview is a 4-row phase list. Persist kept. |
| Intern “You are here” strip | Flag off. |
| Forgot-password email | Deferred. |
| Cross-tenant automated tests | Deferred; manual QA. |
| Full compliance digest email | Deferred. |
| Onboarding wizard | `OnboardingWizard` (Company → Directors → Office → Foreign → Review) — **legacy light-theme island**, not the primary create-project path. Create project form is the real intake. |
| `MetricCard` | Dead code. |
| Dual toasts | shadcn toast + react-hot-toast live together. |

## J. What “a feature change” usually touches

- **UI-only**: `app/globals.css` tokens, `src/components/noir/*`, shell, views.
- **Copy-only**: labels in checklist, empty states, marketing sections.
- **Workflow**: `src/lib/checklist-step-gate.ts`, review helpers, `notify-engagement-event.ts` — treat as domain.
- **New object types**: new Drizzle table + repository + `AuthContext` scoping + API route + TanStack Query hook. Never import `db` from a view.
