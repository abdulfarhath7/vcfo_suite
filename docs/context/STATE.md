# STATE — verified build state

Last updated: 2026-09-13 (dead-code sweep).

## Done across phases

| Area | Status |
|---|---|
| Setup / seed / Auth.js login | done |
| Phase 0 stubs (intern portfolio, welcome email, resend helper, supabase client) | done |
| Phase 1 API ports | done — `_reference-supabase/` deleted; ~35 real routes |
| Repositories | engagements, profiles, knowledge-bank, audit-events, board-resolution, tasks, document-requests, invites, activity, notifications, compliance, documents, engagement-recipients, engagement-clients |
| Phase 2 localStorage → API | done (AppContext TanStack Query) |
| Phase 3 compliance Inngest job + shared Resend helper | done |
| Process lifecycle emails + multi-user notifications | done — intern Save on complete step emails manager; manager Accept composes to client (CC admin + lead) |
| Multi-client per project + client self-invite | done — `engagement_clients` + `/app/client/team` |
| Client-side audit trail | done — `/app/client/audit` via scoped `/api/audit-logs` |
| Super Admin bird's-eye role | done — `super_admin`, `/app/super/*`, may enter all shells |
| Phase 4 `npm run start:lan` | script present (`next start -H 0.0.0.0 -p 3000`) |
| Light/dark theme toggle | wired in TopBar + login |
| POST create project + client | `/api/engagements` POST |
| Change password (authenticated) | `/api/account/password` |
| Four-role model | extended — `super_admin` / `admin` / `manager` / `intern` / `client` |
| Compliance visible pre-COI | done — `isIncorporated` helper + `PreIncorporationNotice`; client Calendar/Filings, staff tracker/statutory (single company), super project rail; portfolio views keep real rows |
| WhatsApp notifications | done — outbound-only nudge channel beside email, six utility templates, consent + kill switch. **Two transports** behind `WHATSAPP_PROVIDER`: `aws_eum` (AWS End User Messaging, bills on the AWS invoice) and `twilio` (legacy fallback). Ships defaulting to `twilio`; inert until `WHATSAPP_ENABLED=true` and the out-of-band setup in `AWS-EUM-WHATSAPP-PLAN.md` §6 is done |
| CR: Part A intake, NIC, MCA tab order, manager windows, lead compliance gate | done (2026-09-15) — 7 phases in `docs/CR-entity-type-mca-order-date-windows.md`; discovery in `…-DISCOVERY.md`. Parent entity captured in Part A only (Dependent); `part-a-sections.ts` single source for tabs; 5-digit NIC + auto business type (`nic-2008.json`); MCA tab order; `engagements.schedule` + `compliance_instances.window_*` (migration 0019) with manager controls; lead sees Compliances only once an engagement is incorporated. Not deployed yet; owner testing pending |
| Company type Dependent / Independent | done (2026-09-15) — `ownership_type` column (0018); create-project asks it first; Independent skips parent + subsidiary details and origin, pre-1 parent sections + board-resolution date, pre-2/pre-3 seeded N/A |
| Outlook connect on AWS | done (2026-09-15) — `azure_ad_*` set in `infra/terraform.tfvars` (same Azure app "VCFO Suite Outlook" as `.env.local`), applied: secret `vcfo-suite/AZURE_AD_CLIENT_SECRET` + ids in App Runner env. Redirect `https://app.sbctrack.in/api/outlook/callback` must stay registered on the Azure app. Deploy of `96cfafa` (visibility + autosave + deliver gating) live same day |
| **AWS Stage 2 — deployed** | done (2026-09-11) — `https://ebuwqhvnuy.ap-south-1.awsapprunner.com`, account 600627321277, ap-south-1. Terraform in `infra/` (remote state `vcfo-suite-tfstate-600627321277`): RDS `vcfo-suite-db` (public + `rds.force_ssl`, option B), S3 `vcfo-suite-documents-600627321277`, ECR `vcfo-suite`, App Runner `vcfo-suite` (auto-deploy on `:latest`), Secrets Manager `vcfo-suite/{DATABASE_URL,AUTH_SECRET}`, SES identity `sbctrack.in` (DKIM CNAMEs pending at DNS; account in SES sandbox), Budget $25. Migrated (18) + seeded demo users. Login verified via curl. Runbook `infra/README.md` |
| Deliver to client gated by manager | done (2026-09-15) — intern “Deliver to client / Update client portal” removed; Submit (with the old delivery required-field checks folded in) → manager Accept stamps `deliveredToClientAt` + syncs pre-12 incorporation date; `POST /checklist` strips release fields from lead patches (`leadWritablePatch`). Lead autosave: debounce actually fires now, flushes on unmount / tab hide / pagehide (keepalive), draft = saved ⊕ touched fields; `engagementsSettled` waits for state so a hard refresh no longer bounces to Clients |
| Step visibility per viewer | done (2026-09-15) — lead drafts hidden from manager/admin/client until Request approval; client sees a lead's step only after the manager accepts (rejected / change-requested pulls it back); pending lead request is `waiting`, not a green tick; vault / documents index / signed URLs follow the step. Server-side redaction in every checklist route (`checklistStateForViewer`), policy + tests in `src/lib/checklist-visibility.ts`. `patchChecklistItem` no longer trusts the browser's state copy |
| Manager approvals from step / dashboard / bell | done (2026-09-15) — staff step page shows the lead's filled fields locked plus Accept / Reject (`ChecklistReviewActions`) and Approve-and-send / Decline (`RequestClientFill`) when pending; no locked-step bounce, no lead Save/Next/Submit footer. Shared `usePendingApprovals` feeds Approvals inbox + new dashboard `DashboardApprovalsPanel`. Bell / live-popup Open link lands on that page. Date pickers: `NoirDatePicker` (the only date input in the app, every checklist `type: 'date'` field) is now type-or-pick — typed `DD/MM/YYYY` with auto slashes (ISO / `15 Sep 2026` also parse), month grid + scrollable year grid (1940 → +30y) behind the caption, Clear / Today footer |
| Staff project detail = client incorporation view | done (2026-09-12) — admin + manager `/projects/{slug}` renders the client's four phase cards (`InternPhaseEntryCards`, `client` gate viewer); step workspace opens read-only for staff (`readOnly` prop on `StepDetailContent`, no locked-step bounce). Old `ProjectDetailSections` (tabs/KPIs/resend/activity) removed. Super Admin untouched |
| Compliances nav group for every role | done (2026-09-07) — `compliancesGroup(base)` in all five shells; staff pages `/app/{admin,manager,intern}/compliances/{calendar,filings}` render the same shared views as the client through one wrapper (`CompliancePages`); chrome identical in every shell, picker only with >1 company; legacy `/compliance` + `/compliance/tracker` redirect; `views/admin/Compliance.tsx` retired. See `docs/archive/COMPLIANCE-NAV-REPORT.md` |
| **Dead-code sweep** | done (2026-09-13) — knip + eslint pass: ~100 unreachable files removed (unused shadcn primitives, old onboarding wizard, legacy incorporation sections, keep-alive `_registry` files), 22 unused npm deps dropped, Supabase-era shims deleted (`src/lib/supabase/*` → `src/hooks/use-poll-refresh` etc., `require-role` / `require-manager` → `@/auth/guards`, `send-resend` barrel → `send-email`, `mapSupabaseError` → private `mapApiError`), no-op localStorage stubs (`src/lib/storage.ts`, `regenerateComplianceForEngagement`) and `mockData` seeds removed, ~180 dead exports/types deleted or un-exported, `GoldButton` alias migrated to `AccentButton`. Session reports moved to `docs/archive/`. `*.tsbuildinfo` untracked. `saxes` / `@xmldom/xmldom` now declared. Baseline after: typecheck 0 errors, 960 tests, knip clean (only `server-only-stub` vitest alias) |

## Intentionally deferred / pilot limits

- Email password-reset links (forgot-password UX tells user to ask manager)
- Cross-tenant repository tests (user testing manually)
- AWS: SES production access (quota case 178914709000400 opened 2026-09-11) + DKIM verification (records in DNS, pending), private RDS/VPC connector (option A), Inngest cloud keys, `project` cost-allocation tag activation (key not yet visible in Billing)
- Full email digest from compliance job (console log today)
- Operational Readiness as primary nav/queues (data kept; filtered from primary UX)

## Re-verify when ready

```bash
npm run typecheck
npm run test
npm run dev   # or npm run build && npm run start:lan
```

Demo logins:
- `super@vcfo.local` / `super123` (Super Admin — bird's-eye)
- `admin@vcfo.local` / `admin123` (Firm Admin) — absent from the current local DB (2026-09-07); use `admin-nadia@demo.vcfo.local` / `demo1234` from `db:seed-demo`
- `manager@vcfo.local` / `manager123` (Project Manager)
- `intern@vcfo.local` / `intern123` (Project Lead)
- `client@vcfo.local` / `client123` (Client)
