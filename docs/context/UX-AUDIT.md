# UX Audit — VCFO Suite

Date: 2026-08-11. Method: live browser walkthrough (marketing, login, super, admin shells; 42 screenshots
in `/tmp/cursor/screenshots/` — ephemeral, cleared on reboot) plus a static code audit of all views and
scoped components (intern, client, manager/admin-shared, onboarding, engagement, incorporation).

Baseline stack: Tailwind 3.4 + shadcn/ui, OKLCH "Graphite Violet" tokens in `app/globals.css`,
next-themes (dark default), Manrope / Space Grotesk / IBM Plex Mono, lucide-react icons.

Important nuance discovered during audit: `orange-*` and `indigo-*` Tailwind classes are **remapped to
violet tokens** in `tailwind.config.ts`, so they render correctly in both themes. The true dark-mode
breakers are the default-palette classes: `slate-*`, `bg-white`, `emerald-*`, `red-*`, raw `violet-*`,
`amber-*`, `cyan-*`.

---

## Ranked issues

### P0 — broken (dark-mode breakage, trust)

| # | Issue | Where |
|---|-------|-------|
| 1 | Entire onboarding wizard is a light-theme island: ~100 raw `slate-*` / `bg-white` / `emerald-*` / `red-*` classes. Unreadable in dark mode. | `src/views/onboarding/OnboardingWizard.tsx` + `steps/Step1Company.tsx` (11 hits), `Step2Directors.tsx` (20), `Step3Office.tsx` (17), `Step4Foreign.tsx` (30), `Step5Review.tsx` (7) |
| 2 | Analytics presents hardcoded demo series (`data6`/`data12`) as portfolio metrics. Trust risk. | `src/views/admin/Analytics.tsx` |
| 3 | Docx preview forces `bg-white` page + loading overlay inside dark shell. | `src/components/incorporation/IncorporationDocxPreview.tsx` |
| 4 | Staff branch of checklist milestone cards uses raw slate (`text-slate-900`, `border-slate-100`) while the client branch is tokenized. | `src/components/incorporation/ChecklistMilestoneCard.tsx` |
| 5 | React hydration mismatch error on admin dashboard console (`Date.now()`/`Math.random()` class). | `/app/admin/dashboard` |
| 6 | AuditLog role badge uses raw `violet-200/50/700` (breaks theming) and dark-first `text-amber-200/90` banner (washes out in light). | `src/views/admin/AuditLog.tsx` |

### P1 — inconsistent

| # | Issue | Where |
|---|-------|-------|
| 7 | 4 distinct KPI card implementations: `AccentKpi` (manager dashboard, compliance), `KpiCard` (overview), ad-hoc `Surface` KPIs (firm home, intern Today), `MetricCard` (dead code). | dashboards across shells |
| 8 | 10+ status badge/pill systems for the same concepts: `StatusPill`, `StatusBadge`, `StatusDot`, `StatusPillWithTimeline`, `ResponsibleRoleBadge`, shadcn `Badge`, per-view `statusMap` clones (intern Requests, admin Compliance), health-map spans, Vault `EntityPill`, ad-hoc rounded-full spans. | app-wide |
| 9 | Empty-state quality gap: illustrated (`EmptyStateIllustrated`) on ~9 views, bare one-line text on ~10 others (FirmPeople has 7 bare strings, ApprovalsInbox, Clients, Compliances, Incorporation, ClientTeam, FirmDashboard, Compliance). Intern Requests renders a blank table with no empty state at all. | see list |
| 10 | Legacy accent naming: `orange-*` classes, `GoldButton`, `--gold` tokens all render violet. Confusing to maintain, invites accidental raw-orange additions. | `button-variants.ts`, `noir/GoldButton.tsx`, ~15 views |
| 11 | Marketing + logo hardcode hex (`#1A1B22`, `#A78BFA`, `#7C5CFC`...) bypassing tokens. | `LandingCta.tsx`, `HeroProductPlane.tsx`, `SbcLogo.tsx` |
| 12 | Dual toast systems live simultaneously (shadcn toast + react-hot-toast; `sonner.tsx` is a fake re-export). | `src/components/ui/` |
| 13 | Progress bars diverge: orange gradient vs `bg-gold` vs gold-sheen across manager lists. | `ProjectsSections.tsx` et al. |
| 14 | Frequent full-screen "Opening VCFO Suite..." loading screen between page navigations instead of skeletons; feels slow. | shell-level |
| 15 | People page surfaces generated IDs (`ib35ba39e75`) as user-facing text. | `/app/admin/people` |

### P2 — polish

| # | Issue | Where |
|---|-------|-------|
| 16 | Icons are near-monochrome everywhere (muted gray or single violet accent); dashboards read flat, KPIs lack color coding. | app-wide |
| 17 | Settings page only offers change-password; no profile/notification/appearance sections. | `AccountSettings.tsx` |
| 18 | Landing stats show raw seed numbers ("2, 0, 0"); `/roles` hero has large empty whitespace. | marketing |
| 19 | Contact form "Open email draft" pattern may confuse; fine for pilot. | `/contact` |
| 20 | `BucketBadge` (unwired) carries raw `violet-50`/`cyan-50`; common `EmptyState.tsx` is slate-based — both are landmines if reused. | `src/components/common/` |
| 21 | `NoirDatePicker` and `.milestone-form-input` use `bg-white`. | `noir/NoirDatePicker.tsx`, `globals.css` |

---

## IA observations per shell

- **Admin**: Projects not in primary nav (dashboard-only entry) — deep links exist but discoverability low. `overview`/`engagements` are redirect stubs. Approvals is an empty page with no guidance when queue is empty.
- **Manager**: mirrors admin via `use-staff-base-path`; nav labels differ slightly between shells ("Home" vs "Dashboard").
- **Intern**: `tasks` and `requests` exist but are off primary nav; Today is the anchor screen — good pattern, thin KPIs.
- **Client**: Messages is a dead redirect (view orphaned); `progress` and `board-resolution` off-nav; inbox-first IA is sound.
- **Super**: launcher-only dashboard; adequate for the role's purpose, but no aggregate KPIs.

## What is already good

- One shared shell (`AppShell` + `RoleSidebar` + `TopBar`) with role theming hooks (`data-role` overrides) — strong base.
- Token system is semantic OKLCH with light/dark + role variants; most staff views already consume it.
- Single icon library (lucide-react); command palette; page transitions; illustrated empty-state component exists.
- Login and marketing pages are polished in both themes (colorful tinted info chips on login are the best "colorful" pattern in the app today).

## Direction input from stakeholder

Reference dashboards shared (colorful CRM/finance UIs): tinted KPI cards with colored icon chips,
colorful status badges, both light and dark executed with confidence. Desired: more color, colorful
icons, better icons, "awesome" look — as inspiration, not copy.
