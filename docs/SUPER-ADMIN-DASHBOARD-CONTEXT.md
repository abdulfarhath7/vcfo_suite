# Super Admin Dashboard — build context for Claude Code

**Mission:** Rebuild the VCFO Suite **super admin** surface from scratch into the org-wide command center — an observatory over both the firm and client sides, with overview → drill-down navigation. You may delete and rewrite the existing super admin code freely.

**The one requirement that outranks everything else in this file: UI/UX consistency.** Every dashboard in VCFO Suite must read as **one product**. The **Project Lead dashboard** (the owner built it and is happy with it) is the **canonical design system**. Match it exactly. The super admin dashboard must look and feel like it was built by the same hand on the same day as the lead dashboard.

This context is the *how-to-build*. Two companions:
- **`SUPER-ADMIN-DASHBOARD-SPEC.md`** — the *what should exist* (domains, screens, chart inventory, KPIs). Follow it for scope.
- **`SuperAdminDashboard.jsx`** — a prototype showing *layout and drill intent only*. **Do not copy its components or inline styles.** It was built standalone; the real components come from the repo (see §1).

Work continuously and methodically, take the time it needs, and make it great and consistent before calling anything done.

---

## 0. Why this file leads with consistency

When the client dashboard was built it **drifted** from the lead dashboard — e.g. metric cards were placed as bare floating cards *outside* a panel, unlike how the lead dashboard composes them. **That kind of drift must not happen again.** The root cause is that the codebase carries duplicate primitives (per the project notes: ~4 competing KPI components — `AccentKpi`, `KpiCard`, ad-hoc `Surface`, dead `MetricCard` — and 10+ status pills). If you pick a *different* KPI component or pill than the lead dashboard uses, the surfaces silently diverge.

**The fix is discipline, encoded below:** find the exact components the lead dashboard uses, use only those, and never fork a parallel variant.

---

## 1. Read and inventory before you build (mandatory first step)

Before writing any UI, open the **Project Lead dashboard** in the repo (under `app/app/intern/*` — Today, engagement overview, step workspace) and read how it is actually built. Then create **`DESIGN-SYSTEM-INVENTORY.md`** at repo root and fill this table by inspecting the real code:

| Element | Canonical component (as used by the lead dashboard) | File path |
|---|---|---|
| Metric / KPI card | *(find it)* | |
| Panel / card container | | |
| Section header / title | | |
| Status pill / chip | | |
| Progress bar / track | | |
| Empty state | | |
| Loading skeleton | | |
| Chart styling (if any charts exist) | | |
| Page header + back button | *(likely `PageHeader` / `PageBackButton`)* | `src/components/shell/*` |
| Sidebar / shell / top bar | | `src/components/shell/*` |
| Spacing / radius / typography scale | *(note the actual values used)* | `app/globals.css`, `tailwind.config.ts` |

Rules that come out of this inventory:
- **These become the only components you use.** Where two versions exist in the codebase, **the one the lead dashboard uses wins**; treat the others as deprecated for this surface — do not import them.
- Also read the noir kit (`src/components/noir/*`), `src/lib/phase-colors.ts`, and `src/lib/motion.ts` so you reuse existing primitives rather than inventing.
- Read `SuperAdminDashboard.jsx` **only** for layout composition and drill behaviour — never lift its inline-styled components into the repo.

Log the inventory before you build. If you can't tell which component the lead dashboard uses for something, replicate its JSX structure for that region rather than guessing.

---

## 2. The consistency contract (hard rules)

Every one of these must hold. This is what "consistent" means concretely:

1. **Same components, not lookalikes.** Reuse the exact canonical components from §1. Do **not** create a new KPI card, panel, pill, or progress bar for super admin. If super admin needs something the lead dashboard lacks (a table, a chart), see §9.
2. **Same composition, not just same parts.** Match *how* the lead dashboard arranges things. Specifically: **the KPI/metric row must be composed exactly like the lead dashboard's** — same wrapper, same grid, same in-panel-vs-standalone placement. **Do not place bare metric cards floating outside a panel** if the lead dashboard nests them (the client-dashboard mistake). When in doubt, mirror the lead dashboard's JSX for that region.
3. **Same tokens.** Spacing, radius, padding, colour, and typography come from the shared tokens (`globals.css` / `tailwind.config.ts`). Zero hardcoded hex, zero one-off spacing values.
4. **Same typography roles.** Serif display, Manrope UI, IBM Plex Mono for identifiers/metadata — used in the same roles as the lead dashboard.
5. **Same status language.** Status only in chips/icons/chart fills (teal done, coral waiting, slate lock, rose overdue), never as page fill. Use the canonical pill from §1 — do **not** introduce another status component.
6. **Same charts everywhere.** Build a **shared chart layer** (§9) so every chart in every dashboard is visually identical; do not style charts ad hoc per screen.
7. **Same motion.** Reuse `src/lib/motion.ts` conventions (layoutId pills, restrained action-triggered transitions). No new bespoke animations.
8. **Same empty and loading states.** Reuse the canonical empty state and skeletons — never a full-screen boot screen, never a blank block.
9. **Same dark/light behaviour** on the same token system. Gold is a **badge only**, never a theme.

If building super admin reveals that a canonical component is missing (the codebase never had a proper single KPI/pill), **extract one shared component, use it here, and note it** so the client and lead surfaces can converge on it later — do **not** fork a super-admin-only version.

---

## 3. Defaults / assumptions (owner can override)

| Decision | Default | Note |
|---|---|---|
| **Actions** | **Observatory-only** — read everything, no write actions (approve/reassign/create) in v1. | Owner may later add permissioned write actions; each needs its own API route + audit entry. |
| **Enter-as** | **Read-only inspection** of any `/app/{role}` shell — never mutates role-scoped data. | Owner may want full impersonation later. |
| **Brand** | Build on the **current tokens** and canonical components. Consistency now beats waiting for a rebrand. | A future rebrand reskins all dashboards via tokens at once. |
| **Route root** | `/app/super/*`. | — |

Don't block on these; build with the defaults and leave `// TODO(owner):` markers where a flip matters.

---

## 4. How to work (continuous, methodical protocol)

1. **Maintain `SUPER-ADMIN-BUILD-PROGRESS.md`** at repo root — mirror the backlog in §11 as checkboxes, log decisions and any component-inventory corrections. Makes the build resumable across sessions; on restart, read it and continue.
2. **Order:** inventory (§1) → shared chart layer + data layer (§9, §7) → screens one at a time.
3. **One module at a time, fully:** read the canonical component → build using it → self-review against the design + consistency bar (§10) → verify (§12) → check it off → continue. Never batch half-finished modules.
4. **Don't stop for permission** except when a change touches a do-not-break guardrail (§6) or needs an uncovered product decision — pick the safe default, add `// TODO(owner):`, log it, continue.
5. **Small, verified commits**; keep the working branch green (typecheck + tests) at every commit.
6. **When the backlog is done, do the full consistency + polish pass (§11 P3)** — don't declare victory early.

---

## 5. What super admin is for (brief)

Two jobs: an **observatory** (a live, honest picture of firm health across both sides) and a **launchpad** (drill from the bird's-eye view down to a single step, document, or person, and enter any role's shell to inspect it). Overview answers "is the firm healthy and what needs me?" in five seconds; every element drills to the detail behind it. Full domain/screen scope is in `SUPER-ADMIN-DASHBOARD-SPEC.md`.

---

## 6. Do-not-break guardrails

- **Enter-as is inspection only** — it must never mutate role-scoped data.
- **Gold = badge, never theme.**
- **Real data only.** Every number/chart reads live data via the repository layer. No demo/placeholder series on shipped screens; absent data → canonical empty state.
- **Repository seam is sacred** — views never import `db`; data comes via API route → repository with `AuthContext`.
- **No secrets in the client bundle.**
- When viewing client/lead surfaces through super admin, **respect the same workflow semantics** they have everywhere (e.g. still no board-resolution drafts surfaced to the client through any lens).
- **Do not edit** `src/data/checklist.ts`, the gate logic, validators, docx generators, compliance math, or email/Outlook fan-out.

---

## 7. Data layer (build early, right after the shared chart layer)

Everything on this surface is a **read**, scoped to "all engagements" for super admin.

- **Primary aggregate:** `getSuperAdminOverview(ctx: AuthContext)` in a repository under `src/db/repositories/*`, exposed via `app/api/super/overview/route.ts`, consumed by a `useSuperAdminOverview()` TanStack Query hook.
- **Per-domain reads:** engagements list, engagement detail, compliance, people/workload, approvals, activity, documents — each a repository fn + API route + hook taking `AuthContext`.
- Aggregate **server-side**; paginate the long lists (engagements, activity).
- **Required test:** a scoping test proving the super read is correctly permissioned (and that non-super roles cannot hit these routes).
- Reuse existing gate/status logic (`checklist-step-gate.ts`) to derive phase, health, next-action, overdue — do not reimplement.

Data → chart mapping and KPI computation are specified in `SUPER-ADMIN-DASHBOARD-SPEC.md §5–6`.

---

## 8. Screens

Build the screens described in `SUPER-ADMIN-DASHBOARD-SPEC.md §4`: Overview (L0) → Engagements list (L1) → Engagement detail (L2) → Compliance, People, Approvals, Activity, Documents; plus enter-as-shell (L3). Breadcrumb (`Home › …`) walks back up; command palette (⌘K) is the only search.

For **every** screen, composition defers to the consistency contract (§2): reuse the lead dashboard's KPI/panel/header/pill/progress patterns and placement. The Overview KPI row in particular must be composed exactly like the lead dashboard's metric region.

---

## 9. Net-new patterns super admin introduces (build them consistently)

Super admin needs a few things the lead dashboard doesn't have. Build each from the **same tokens and canonical primitives** so it feels native, and extract anything reusable into a shared location so other dashboards can adopt it.

- **Shared chart layer** — create `src/components/charts/*` (or the repo's equivalent): a themed tooltip, a colour scale derived from the phase/accent tokens, and default axis/grid/bar props. **Every chart in every dashboard uses this.** Build it first so charts are identical from day one; the client dashboard's charts should later adopt it too. (recharts is already in the stack.)
- **Data table** — for the engagements list and activity. Style it from the same tokens as the lead dashboard's list rows (same row height, hover, dividers, chip usage). Do not pull in a differently-styled table.
- **Drill navigation + breadcrumb** — reuse the shell's breadcrumb/back patterns (`src/components/shell/*`), not a new nav.
- **Enter-as launch** — reuse existing buttons/links; read-only inspection.

If any of these ends up genuinely reusable, put it in shared components and note it in `DESIGN-SYSTEM-INVENTORY.md` as a new canonical piece.

---

## 10. Design + consistency quality bar (definition of done)

A module is done only when all hold:

- **Component identity:** every element uses a canonical component from §1 — no lookalike variants, no new KPI/pill/panel.
- **Composition matches** the lead dashboard for equivalent regions (KPI row placement especially).
- **Tokens only:** no hardcoded hex or one-off spacing; a future rebrand reskins via `globals.css` alone.
- **Charts** all use the shared chart layer; donuts ≤6 slices; status colour only in chips/fills, never page fill.
- **Typography, radius, density** indistinguishable from the lead dashboard.
- **Motion, empty states, skeleton loading** reuse existing conventions; no full-screen boot screen.
- **Dark + light** both first-class on the same tokens; gold is a badge only.
- **Responsive** down to mobile; keyboard focus visible; reduced motion respected.
- **Side-by-side consistency audit passed:** open the lead dashboard and this screen next to each other; a KPI card, a status chip, a section header, and a list row must be visually identical. Fix any drift before checking the module off.

---

## 11. Build backlog (sequence; mirror into the progress file)

**P0 — foundation + consistency spine**
- [ ] Inventory the lead dashboard → `DESIGN-SYSTEM-INVENTORY.md` (§1).
- [ ] Shared chart layer (§9).
- [ ] `getSuperAdminOverview` repository + API + hook + scoping test (§7).
- [ ] Shell/nav/breadcrumb for `/app/super/*` (reuse shell primitives).
- [ ] Overview screen — hero, KPI row (composed exactly like lead), core charts, needs-attention, live activity.
- [ ] **Consistency audit** vs. lead dashboard; fix drift.

**P1 — core drill path**
- [ ] Engagements list (canonical table style).
- [ ] Engagement detail (progress ring, phase bars, journey timeline, documents, compliance, activity, ball-in-court, enter-as).
- [ ] **Consistency audit** on both.

**P2 — remaining domains**
- [ ] Compliance · People & workload · Approvals · Activity (global audit) · Documents (firm-wide).
- [ ] Command palette (⌘K) search across engagements/people/documents.
- [ ] Enter-as-shell (read-only) polish.
- [ ] **Consistency audit** across all.

**P3 — full polish + convergence pass**
- [ ] Light/dark audit across every screen.
- [ ] Responsive/mobile audit.
- [ ] Motion + loading-state audit.
- [ ] Hunt and remove any hardcoded hex or one-off spacing.
- [ ] Confirm no duplicate/forked primitives were introduced; if you had to create a shared component, note it for lead/client convergence.
- [ ] Final side-by-side against the lead dashboard for every screen.

---

## 12. Verification (after each module)

- `npm run typecheck` — must pass.
- `npm run test` — must pass (if a domain test breaks, you touched something you shouldn't have — revert).
- Log in as super admin and confirm the module renders with real seed data in **both light and dark**.
- Confirm no `db` import in any view; no locked step made reachable; enter-as mutates nothing.
- **Visual consistency check:** compare against the equivalent region of the lead dashboard; they must match.

---

## 13. What NOT to do

- Do **not** fork or create a new KPI card, panel, status pill, progress bar, or table variant — reuse the lead dashboard's canonical components.
- Do **not** place metric cards outside a panel (or otherwise diverge from the lead dashboard's KPI composition) — the client-dashboard mistake; do not repeat it.
- Do **not** lift components or inline styles from `SuperAdminDashboard.jsx` — it's a layout reference only.
- Do **not** style charts ad hoc — use the shared chart layer.
- Do **not** hardcode colours/spacing or introduce a second theme; gold stays a badge.
- Do **not** ship demo/placeholder data, import `db` in a view, or add write actions without an explicit owner decision.
- Do **not** declare done before the P3 convergence pass and per-module consistency audits.
