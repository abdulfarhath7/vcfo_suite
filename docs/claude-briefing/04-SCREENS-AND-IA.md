# 04 — Screens and information architecture

## App chrome (all authenticated shells)

**L-shaped flush shell** (not a floating card on a canvas):

- Sidebar: `top-0 left-0 bottom-0`. Logo + wordmark in sidebar header when expanded.
- Top bar: from sidebar’s right edge to screen edge. **Wordmark + Search** only (no page title, no breadcrumbs). Theme, notifications, avatar/settings on the right.
- When sidebar is icons-only, **“VCFO Suite”** moves into the top bar (rail too narrow for the wordmark).
- Sidebar modes: **Keep open** / **Keep closed** / auto (hover-peek, 200ms leave delay). Intern Clients list in auto mode expands for the company list; intern engagement pages stay collapsed for workspace width.
- Nested pages: compact **Back** chevron immediately left of the page H1 (`PageBackButton`), not in the top bar. Hidden on primary nav exact paths (Today, dashboards, Clients list, Compliance root).
- Mobile: hamburger → sheet nav.
- Atmosphere: faint blue mesh `.page-atmosphere` (≤4% chroma).
- Command palette: ⌘K.
- Max content width: admin/manager ~1480px, intern ~1400px (full width on engagement step), client ~1200px.

Fonts: **Manrope** (UI), **Space Grotesk** (display, hooked as `font-serif`), **IBM Plex Mono** (ids, kbd, metadata).

Motion: Framer `m` + `LazyMotion` **`domMax`** (layoutId pills). Reduced motion respected. Do not put CSS `transform` on a `layoutId` host.

## Public IA

```
/                 marketing landing
/roles            roles
/contact          contact
/login            sign in
/invite/[token]   accept invite
```

## Super Admin nav

- Overview → `/app/super/dashboard`
- Firm home → `/app/admin/dashboard`
- People, Send email, Firm audit (admin URLs)
- Client portal, Client audit (client URLs)
- Settings → `/app/super/settings`

## Firm Admin nav

- Home → `/app/admin/dashboard`
- Projects → `/app/admin/projects` (+ `/new`, `/[slug]`, `/[slug]/step/[stepId]`)
- People, Send email, Approvals
- Compliance calendar, Doc vault, Knowledge Bank, Analytics, Audit Log
- Settings

Redirect stubs: `/app/admin/overview`, `/app/admin/engagements` (do not treat as product).

## Project Manager nav

Same shape as admin, under `/app/manager/*`, plus **Project leads** (`/team`). Home label is still “Home”. Shared views via `useStaffBasePath`.

## Project Lead (intern) nav

- **Today** — week queue grouped **by company** (A–Z cards). IST clock. Rows: tick + title + chevron. No “Next up this week” hero, no Analytics on this page. Shows completed + in-progress + awaiting-client; omits locked future.
- **Clients** — expandable company sub-rows + View all. Nested active pill.
- Send email, Requests, Compliance calendar, Knowledge Bank, Analytics, Audit Log
- **Not in nav:** Tasks (redirects to Today), intern engagement is reached via Clients/Today not a “Projects” item.

### Intern company overview (`/app/intern/engagements/[id]`)

- Back + serif H1 (company) + compact progress CC chips in one `Surface`.
- Four phase **rows** (full width): SPICe+ Part A, SPICe+ Part B, Post-incorporation, Registration.
- Each row: node + title + tick track + chevron → first not-done step in that phase.
- Registration rows grouped: General, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand, FEMA.
- Phase tabs exist in code but **flag off**.

### Intern step (`.../step/[stepId]`)

Two-column: **form left**, **phase journey rail right** (compact Surface, natural height).  
H1 full width above that row. No `StepWorkspaceRail` (no Client badge, Next, attachments list, Help inset).  
Sticky footer: Request manager approval / Email manager again, Mark all complete (legacy), Save (only when dirty), Deliver.  
Pre-2: single Board Resolution card in form footer. Pre-7 generate panel after form.  
Section tabs: underline strip, last tab = Submit. No playbook SLA / working-days. No status chips.

## Client nav

- **Inbox** — document requests + rejected checklist resubmits, grouped Due today / This week / Later.
- **Incorporation** — gated flowchart (Create-project-style). This **is** progress.
- Compliances, Documents, Team, Activity audit
- Settings
- **Off-nav / redirect:** `/progress` → Incorporation; `/messages` dead; `/board-resolution` exists as a view but primary path is the Pre-2/Pre-3 checklist steps.

Client should feel: “what do you need from me, and what happens next?”

## Screen inventory (authenticated)

### Super
| Route | Purpose |
|---|---|
| `/app/super/dashboard` | Launchers + pulse KPIs |
| `/app/super/settings` | Account |

### Admin / Manager (manager: swap `/admin` → `/manager`)
| Route | Purpose |
|---|---|
| `.../dashboard` | Firm/PM home, stuck projects, KPIs |
| `.../projects` | List |
| `.../projects/new` | Create |
| `.../projects/[slug]` | Detail |
| `.../projects/[slug]/step/[stepId]` | Staff step (journey left + workspace rail right) |
| `.../people` | Directory (admin); manager also has `/team` |
| `.../mail` | Outlook compose |
| `.../approvals` | Review queue |
| `.../compliance` | Calendar |
| `.../vault` | Documents |
| `.../knowledge-bank` | Firm files |
| `.../analytics` | Charts (demo data risk) |
| `.../audit-log` | Trail |
| `.../settings` | Password, Outlook |

### Intern
| Route | Purpose |
|---|---|
| `/app/intern/today` | Work queue |
| `/app/intern/clients` | Companies |
| `/app/intern/engagements/[id]` | Overview |
| `/app/intern/engagements/[id]/step/[stepId]` | Workspace |
| `/app/intern/engagements/[id]/board-resolution` | BR editor |
| `/app/intern/mail` | Compose |
| `/app/intern/requests` | Doc requests |
| `/app/intern/compliance` | Calendar |
| `/app/intern/knowledge-bank` | Files |
| `/app/intern/analytics` | Charts |
| `/app/intern/audit-log` | Route exists; spec says intern has no audit read |
| `/app/intern/settings` | Account |

### Client
| Route | Purpose |
|---|---|
| `/app/client/inbox` | Actions due |
| `/app/client/incorporation` | Gated catalog |
| `/app/client/compliances` | Filings |
| `/app/client/documents` | Shared files |
| `/app/client/team` | Invite / substitute |
| `/app/client/audit` | Their trail |
| `/app/client/board-resolution` | Signed/final BR view |
| `/app/client/settings` | Password |

## IA opinions already in the 2026-08 UX audit (still relevant)

- Admin Projects discoverability was weak when it was dashboard-only; **Projects is now in admin nav**.
- Approvals empty state needs guidance.
- Super dashboard has no rich aggregate BI (by design — launcher).
- Client inbox-first IA is sound; do not add a second “progress” nav.
- Intern Today as the anchor is the right pattern.

## Shared visual primitives (where restyle lands)

| Layer | Location |
|---|---|
| Tokens | `app/globals.css` |
| Tailwind map | `tailwind.config.ts` |
| shadcn | `src/components/ui/*` |
| “Noir” brand kit | `src/components/noir/*` (`Surface`, `AccentButton`, `GoldButton`→blue, `EmptyStateIllustrated`, `StatusDot`, `KpiNumber`, …) |
| Shell | `src/components/shell/*` |
| Admin chrome | `src/components/admin/PageHeader.tsx`, `AccentKpi.tsx` |
| Journey | `JourneyNode`, `src/lib/phase-colors.ts` |
| Marketing | `src/components/marketing/*` |
| Logo | `src/components/brand/SbcLogo.tsx`, `public/logo-mark.svg` |
