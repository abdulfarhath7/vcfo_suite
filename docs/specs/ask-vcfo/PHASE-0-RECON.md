# Ask VCFO (in-app assistant) — Phase 0 recon and owner decisions

Spec: `ASK-VCFO-CONTEXT.md` v2.0 (this folder). Built first from v1.0 under the
working name "Assist", then renamed. Not to be confused with **VCFO Assist**, the
MCA portal Chrome extension (`src/lib/assist-profile/`, spec in
`docs/specs/assist-profile/`).

## Deviations from the spec and how the build follows the repo

| # | Spec assumed | Repo reality | Build decision |
|---|---|---|---|
| 1 | `src/app`, `src/db/schema/*` | App dir is `/app`; schema is one file `src/db/schema.ts`; next migration 0021 | Follow the repo |
| 2 | Client nav "Inbox … Activity audit" | Inline in `RoleSidebar.tsx`: Home · Updates · Incorporation · Compliances · Documents · Team · Audit | Library goes after Documents |
| 3 | Top bar trail · search · Ask VCFO · theme · bell · avatar | trail · search · bells · theme · profile (`TopBar.tsx`) | Ask VCFO right after search; the rest unchanged |
| 4 | Gate on session role | `AppShell` checks role client-side; super admin enters every shell | Mount only when `useApp().user.role` ∈ client / admin / super_admin |
| 5 | "Ask my lead" reuses requests | Clients cannot create `document_requests`; `createClientChangeRequest` is step-bound and reopens the step | **Owner:** a `tasks` row assigned to the lead + notification, no step reopen, no new table |
| 6 | Approvals repository | Pending approvals computed client-side only (`use-pending-approvals.ts`) | Extract to a shared pure lib used by the hook and Ask VCFO tools; hook behaviour unchanged |
| 7 | Compliance calendar repository | `getFilings(ctx, {engagementId})` + `filingStatus` are scoped; `loadComplianceRunway` is private | Use `getFilings` |
| 8 | Repository hides BR drafts | Drafts hidden in routes, not the repository | Ask VCFO tools never read board resolutions in v1 (tested) |
| 9 | Firm name from config | Hardcoded ("SBC" in `SbcLogo`) | **Owner:** `FIRM_NAME = 'SBC'`, env `FIRM_DISPLAY_NAME` overrides |
| 10 | Compose prefill | `ComposeMail` reads only `?to=`; no super admin mail page | Add `?subject=` / `?body=`; super admin uses `/app/admin/mail` |
| 11 | PDF tooling (OD5) | None | **Owner:** add `@react-pdf/renderer` |
| 12 | pgvector | Local `postgres:16` has no `vector`; RDS 16 supports it | Omit `embedding` column in v1 |
| 13 | Anthropic SDK | None installed | **Owner:** add `@anthropic-ai/sdk` + `@anthropic-ai/bedrock-sdk`; default provider `anthropic` |
| 14 | Rate limiter | Existing one is in-memory, 5 per 10 min | New Postgres-count limiter per spec |
| 15 | Cross-tenant tests | Repository tests mock `@/db/client` | New tests follow the mock pattern |
| 16 | Client "Inbox" rows for F1 | No inbox | "What's this?" on Overview next action, Incorporation nodes, step headers, compliance rows |

## Build-time judgement calls

- **Draft topics are served.** All v1 topics are `draft` until the firm reviews
  them. A suggestion that points at a draft topic is still answered without a
  model call, but the envelope carries `origin: "generated"` and `draft: true`
  so the UI shows a "Not yet reviewed · check with your lead" badge instead of
  "Reviewed by {firm}". Publishing a topic (status + reviewer + date) switches it
  to the reviewed badge.
- **Draft topics for every client-owned step** (pre-1, pre-3, pre-13, pre-14,
  pre-15, pre-16, pre-9) were written so the coverage test passes; the firm
  edits and publishes them.
- **Flow stages carry optional `stepIds`** (topic files only) so "You are here"
  is recomputed from the viewer's snapshot.

## Later judgement calls (Phases 3–8)

- **No forced tool use.** The answer model (Sonnet 5.5) returns 400 on a forced
  `tool_choice`, so `render_answer` runs with `tool_choice: auto`, a prompt
  instruction to call it, and the §6.6 text fallback. A server-side refusal
  fallback (`fallbacks: "default"`) is on for the Anthropic API
  (`ASK_VCFO_REFUSAL_FALLBACK=false` turns it off).
- **Runtime flag for the launcher.** `/api/ask/status` reads
  `ASK_VCFO_ENABLED` at request time, so the flag flips without a rebuild.
- **Pending approvals** logic moved from the hook into
  `src/lib/pending-approvals.ts`; the Approvals inbox and Ask VCFO share it.
- **"What's this?" placements:** client Overview next action, the step
  journey rail (open and locked rows), the step title, form section headers,
  field labels that name a glossary term, and compliance calendar / filings
  rows. Buttons sit beside, never inside, links and buttons, and render only
  for the client persona, so shared staff views are unchanged.
- **Glossary underline** is applied to the next-action title and description.
  Journey rail labels and calendar names sit inside links / buttons (an
  underline card there would nest interactive elements), and step
  descriptions are not rendered anywhere today.
- **PDF sources are transcribed by the contextualizer model** (Messages API
  PDF input) because no PDF text extractor is installed; DOCX is read with
  pizzip; TXT / MD directly. Swap in a parser later if fidelity matters.
- **Ingestion falls back to in-process** when Inngest is unreachable.
- **Super admin "Draft reminder"** opens `/app/admin/mail` (super has no mail
  page of its own). Compose now pre-fills `?subject=&body=`; nothing sends
  until Send is pressed.
- **Evals:** `tests/ask/evals/` — 64 cases in mock mode (CI) and
  `npm run eval:live` against the real models (not yet run: no key locally).

## v2.0 rename (Ask VCFO)

- Code namespace `ask`: `src/lib/ask`, `src/components/ask`, `src/data/ask`,
  `src/hooks/ask`, `app/api/ask`, `src/views/{client,admin}/ask`, `tests/ask`,
  repositories `ask-*.ts`, job `ask-ingest`, admin page `/app/admin/ask-vcfo/sources`.
- Tables renamed in migration `0022` (`assist_*` → `ask_*`, indexes and
  constraints too; rows kept). `0021` is untouched.
- Env `ASSIST_*` → `ASK_VCFO_*`; Terraform `ask_vcfo_enabled`, secret
  `/vcfo/ask-vcfo/anthropic-api-key`.
- Phase 9 (owner delegated the choice): C1–C5 built behind
  `ASK_VCFO_FEATURE_<ID>` flags, all off. A1 (question gaps) is built behind `ASK_VCFO_FEATURE_A1` (off). Turning it on also shows the client visibility notice in the panel. The wording is the owner's to confirm before enabling.

## v2.0 build notes (go-there links, Phase 9)

- **Focus anchors** are `data-ask-focus` attributes on journey rail rows
  (step id), Incorporation phase rows (phase id; a step id falls back to its
  phase row there), and compliance rows (instance id). One handler mounted
  with the panel serves every page. A dedicated one-shot `.ask-focus-pulse`
  is used; `.journey-node-pulse` loops forever and marks the current step.
- **No client Inbox** exists, so `{ to: "inbox" }` resolves to client Home.
- **Staff links** resolve through `adminProjectPath` / `adminProjectStepPath`
  / `staffProjectBase`; super admin lands on the firm admin pages, as those
  helpers already decide.
- **C2** follows the v1 draft rule (draft topic served with the "Not yet
  reviewed" badge). **C3** lines and **C5** obligation topics are shown only
  when reviewed, per their guardrails, so both features show nothing until
  the firm marks content reviewed / published.
- **C5 obligation topics** contain no rupee amounts or calendar dates; the
  firm adds exact figures during review.
- **Feature flags in Terraform:** `ask_vcfo_features = ["C1", …]` in
  `terraform.tfvars` sets `ASK_VCFO_FEATURE_<ID>=true` in App Runner.
- A1 (question gaps) is built behind `ASK_VCFO_FEATURE_A1` (off). Turning it on also shows the client visibility notice in the panel. The wording is the owner's to confirm before enabling.
