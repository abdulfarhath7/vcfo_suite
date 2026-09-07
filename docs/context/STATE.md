# STATE — verified build state

Last updated: 2026-09-07 (nested Compliances nav group across all roles).

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
| Compliances nav group for every role | done (2026-09-07) — `compliancesGroup(base)` in all five shells; staff pages `/app/{admin,manager,intern}/compliances/{calendar,filings}` render the same shared views as the client through one wrapper (`CompliancePages`); chrome identical in every shell, picker only with >1 company; legacy `/compliance` + `/compliance/tracker` redirect; `views/admin/Compliance.tsx` retired. See `COMPLIANCE-NAV-REPORT.md` |

## Intentionally deferred / pilot limits

- Email password-reset links (forgot-password UX tells user to ask manager)
- Cross-tenant repository tests (user testing manually)
- AWS Stage 2 Terraform finish
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
