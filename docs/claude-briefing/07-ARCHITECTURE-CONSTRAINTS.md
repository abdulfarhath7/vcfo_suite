# 07 — Architecture constraints

Implementation Claude (later) must obey these. Decision Claude should **not** propose features that require violating them unless the owner explicitly accepts a platform change.

## Sacred seam

- **Only** `src/db/repositories/*` may import `db`.
- Views, domain, routes call repositories (or API routes that call repositories).
- Never `import { db }` from a component “just this once”.
- Never import `s3` from a component — `src/storage/s3.ts` behind helpers/repos.

## Access control = Path A

Old Supabase RLS is the **spec**, not the implementation. Repositories take `AuthContext` and filter by role. See `src/db/repositories/README.md`. New tables need the same pattern + a cross-tenant test.

## Do not casually edit lifted domain

`src/data/checklist.ts`, per-step validators (`src/domain/` / `src/lib/checklist-*-validation.ts`), docx generators, compliance math — **ported and tested**. Edit only if a test fails or the owner explicitly changes the playbook.

## Stack (local = prod shape)

| Piece | Local | AWS later |
|---|---|---|
| App | Next.js 16 App Router, React 19 | App Runner (planned) |
| DB | Docker Postgres, Drizzle | RDS |
| Files | MinIO | S3 |
| Auth | Auth.js credentials | same |
| Jobs | Inngest | same |
| Email | Resend (or console skip); SES adapter exists | `EMAIL_PROVIDER=ses` when ready |
| Staff mail | Microsoft Graph Mail.Send | same |

No Supabase. No Kubernetes. No Lambda-everything. Env vars for all endpoints — never hardcode.

## Data model (mental)

Central row: **`engagements`**. Checklist lives in **`checklist_state` jsonb** (domain already knows this blob).  
Membership: `engagement_clients`, `engagement_leads`, `engagement_managers`.  
One board-resolution row per engagement (PK = `engagement_id`).  
Files: S3 keys in columns (`storage_path`, knowledge bank, milestone-documents prefix).  
New localStorage replacements: `tasks`, `document_requests`, `invites`, `activity`, `notifications`.

App state for the SPA: **TanStack Query** via `AppContext` (Phase 2). Do not put engagement truth back into localStorage.

## API surface (representative)

Auth: `/api/auth/[...nextauth]`.  
Engagements CRUD, checklist submit/review/unlock, milestone documents, board-resolution generate/finalize/download/signed upload, incorporation-docs generate/share/download, DIR-2 generate/download, clients invite/substitute, leads, progress-cc.  
Firm: `/api/admin/people`, managers, interns, clients.  
Ops: tasks, requests, invites, activity, notifications, knowledge-bank, documents, audit-logs, email-templates, outlook connect/send/directory, account password/profile, welcome email, Inngest webhook.

UI never talks to Postgres; it `fetch`es these routes.

## Email / Outlook (easy to break)

Single dispatcher: `src/lib/email/send-email.ts`. Do not add a second Resend/SES call site.  
Fan-out: `notifyEngagementEvent` / `notifyEngagementEventBackground`.  
Recipients: `engagement-recipients.ts`.  
Lead-manager notify helper must stay autosave-safe: `lead-manager-request-notify.ts`.

`AUTH_URL` should stay **unset** locally (`AUTH_TRUST_HOST=true`) or LAN/tunnel login breaks.

## UI architecture

- Routes: `app/app/{role}/.../page.tsx` (nested `app/app` is intentional).
- Views: `src/views/{admin,intern,client,engagement,incorporation,onboarding,staff,super,settings,auth,knowledge-bank}/`.
- Shared incorporation forms: `MilestoneResponseForm*` — intern vs client vs staff **branches** via props (`hideTimeline`, `hideStatus`, `sectionTabs`, `allowLockedOpen`). A restyle should keep those flags.
- Intern overview helpers: `src/lib/intern-overview-progress.ts`, `src/lib/intern-dashboard.ts`.
- Paths: `src/lib/project-step-path.ts`, `src/lib/auth-routes.ts`.

## Next.js note

This repo’s Next 16 is not “the Next.js you memorized”. Read `node_modules/next/dist/docs/` before inventing App Router APIs. `next dev` injects an agent-rules block into `CLAUDE.md`.

## Verification

```bash
npm run typecheck && npm run test
```

Do not stack unverified platform work. Visual token changes should still typecheck; they rarely need domain test edits.

## Safe vs unsafe change classes

| Safe (typical reskin) | Unsafe without a product decision |
|---|---|
| CSS variables, fonts, logo, marketing, padding, radius | New checklist steps / skip sequential gate for clients |
| Consolidating KPI/status/empty-state components | Importing `db` in views |
| Sidebar labels, icon set, colourful chips | Client chat without a real channel |
| Dark/light polish | Replacing Auth.js or bringing back Supabase |
| Empty-state illustrations | Changing finalize/notify/email semantics |
| Cutting dead routes (messages redirect) after confirming | Showing BR drafts to clients |
| Analytics using **real** engagement data | Shipping hardcoded demo charts as “portfolio metrics” |
