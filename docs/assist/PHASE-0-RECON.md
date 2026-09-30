# VCFO Assist (in-app assistant) — Phase 0 recon and owner decisions

Spec: `VCFO-ASSIST-CONTEXT.md` (repo root). Not to be confused with the MCA
portal extension profile in `src/lib/assist-profile/`, which is a separate feature.

## Deviations from the spec and how the build follows the repo

| # | Spec assumed | Repo reality | Build decision |
|---|---|---|---|
| 1 | `src/app`, `src/db/schema/*` | App dir is `/app`; schema is one file `src/db/schema.ts`; next migration 0021 | Follow the repo |
| 2 | Client nav "Inbox … Activity audit" | Inline in `RoleSidebar.tsx`: Home · Updates · Incorporation · Compliances · Documents · Team · Audit | Library goes after Documents |
| 3 | Top bar trail · search · Assist · theme · bell · avatar | trail · search · bells · theme · profile (`TopBar.tsx`) | Assist right after search; the rest unchanged |
| 4 | Gate on session role | `AppShell` checks role client-side; super admin enters every shell | Mount only when `useApp().user.role` ∈ client / admin / super_admin |
| 5 | "Ask my lead" reuses requests | Clients cannot create `document_requests`; `createClientChangeRequest` is step-bound and reopens the step | **Owner:** a `tasks` row assigned to the lead + notification, no step reopen, no new table |
| 6 | Approvals repository | Pending approvals computed client-side only (`use-pending-approvals.ts`) | Extract to a shared pure lib used by the hook and Assist tools; hook behaviour unchanged |
| 7 | Compliance calendar repository | `getFilings(ctx, {engagementId})` + `filingStatus` are scoped; `loadComplianceRunway` is private | Use `getFilings` |
| 8 | Repository hides BR drafts | Drafts hidden in routes, not the repository | Assist tools never read board resolutions in v1 (tested) |
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
