# 02 — Roles and access

Code enum: `super_admin` | `admin` | `manager` | `intern` | `client`.  
User-facing labels: Super Admin, Admin, Project Manager, **Project Lead**, Client.

The word **intern** is a **code name only**. Never show “intern” in UI copy. Always **Project Lead**.

## Homes after login

| Role | Home | Shell prefix |
|---|---|---|
| Super Admin | `/app/super/dashboard` | `/app/super` + may enter all `/app/*` |
| Firm Admin | `/app/admin/dashboard` | `/app/admin` |
| Project Manager | `/app/manager/dashboard` | `/app/manager` |
| Project Lead | `/app/intern/today` | `/app/intern` |
| Client | `/app/client/inbox` | `/app/client` |

Cross-role URLs bounce via middleware. Super Admin is the exception (may enter every segment). Use `staffBase` / `adminProjectPath` — never hardcode `/app/manager` in shared staff UI.

## What each role is for

### Super Admin

Bird’s-eye. Launcher dashboard into firm console, client portal, firm audit, client audit. Tiny **gold chip** in UI only — not a gold theme. Seed: `super@vcfo.local`.

### Firm Admin (`admin`)

Firm-wide. Unrestricted repository access (old “manager unrestricted”). Creates projects and **must assign a Project Manager**. People directory, all projects, approvals, vault, knowledge bank, analytics, audit. Can also use manager-like project pages under `/app/admin/projects/...`.

### Project Manager (`manager`)

Scoped to engagements they own (`engagements.manager_id` or `engagement_managers` membership; legacy: `manager_id` null and `admin_id` = self). Creates projects as **self**. Approvals inbox, team (project leads who report to them), mail, compliance, vault, KB, analytics, audit on owned work.

### Project Lead (`intern`)

Assigned via `engagements.intern_id` / `engagement_leads`. **Today** is the work queue. Clients list → company overview (4 phases) → step workspace. Requests (document requests). Cannot see firm people admin. Knowledge bank: **read all**, upload own. Audit: **none** at repository spec (intern audit page exists in routes — treat as thin/limited; do not design intern as the compliance officer of record). Reports to a manager (`profiles.reports_to_manager_id`).

Intern **ignores sequential lock for navigation** (can open future steps). Client portal still waits. Intern PATCH is not blocked by sequential lock.

### Client

Sees only their engagement(s) via `client_user_id` / `client_id` / `engagement_clients`. Inbox-first. Sequential catalog on Incorporation. Can invite teammates, substitute themselves or a peer, see a **scoped** activity audit. No knowledge bank. Documents only when shared. Board resolution drafts hidden until **finalized**.

## Access control (product rules)

Enforced in **`src/db/repositories/*`**, not Postgres RLS. Every repo takes `AuthContext` and filters by role.

| Surface | Admin | Manager | Lead | Client |
|---|---|---|---|---|
| Engagements | all | owned | assigned | own membership |
| Board resolution | all | via engagement | read + draft update while `draft` | read after rules (hidden until finalized) |
| Knowledge bank | all | all | read all + insert own | none |
| Compliance obligations | all | all | read | read |
| Compliance instances | all | owned eng | write assigned | read own |
| Audit events | read all | owned eng | none (spec) | scoped client audit API |
| Documents | all | owned | assigned | shared_with_client only |
| Notifications | per user | per user | per user | per user |
| Outlook | own mailbox | own | own | none |
| Email templates | mutate any | mutate any | mutate own | none |

Creating a project: Admin POST must include `managerId`. Manager POST forces `managerId` to self.

## Org chart

```
Super Admin (inspects everything)
  └── Firm Admin (firm-wide)
        ├── Project Manager(s)
        │     └── Project Lead(s)  (reports_to_manager_id)
        └── Clients (per engagement; owner + members)
```

Many leads, many managers, many clients per engagement.

## UI implications of roles

- **Same staff views** are reused under `/app/admin/*` and `/app/manager/*` via `useStaffBasePath`. Changing admin Home also changes manager Home unless you split the views.
- **Intern UI is a different product surface**: denser workspace, no SLA “working days”, no status chips, phase-scoped journey rail, autosave.
- **Client UI is calmer and gated**: Inbox + flowchart; copy says “This opens after {title} is complete” never “access denied”.
- `document.body` gets `data-role="{role}"` for CSS role accents (today all still blue-family).

## Auth

Auth.js credentials (email + password on `profiles`). Login path `/login`. Change password `/api/account/password`. Invite accept `/invite/[token]`. Password reset email **not** implemented (UX: ask manager). Theme toggle on login + TopBar (`next-themes`, light/dark).
