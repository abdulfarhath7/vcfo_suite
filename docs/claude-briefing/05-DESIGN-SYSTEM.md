# 05 — Current design system

Use this when proposing a new look. **Change tokens first**; most screens already consume them. Raw Tailwind palette classes (`bg-white`, `slate-*`, `emerald-*`) are the landmines.

## Brand intent today

**Cool professional blue** in a 60 / 30 / 10 split:

- **60%** cool slate neutrals (blue undertone — never sand, cream, beige)
- **30%** primary blue ≈ `#2563EB` (hover `#1D4ED8`)
- **10%** semantic accents (success, waiting, error, phase washes)

CTAs, links, focus rings, current-step nodes, progress bars = **blue**. White label on blue — never navy-on-blue.

**Do not** treat orange / terracotta / peach / sand as brand. `--orange-*` and `--gold-*` are **deprecated aliases of `--blue-*`**. `GoldButton` renders blue. Leftover class names `orange-*` still look blue.

Super Admin: tiny `.super-gold-chip` only — never a gold CTA theme.

Dark mode: same cool blue/slate family — **not** a brown invert.

Stakeholder direction already on file (UX audit): they liked colourful CRM/finance dashboards (tinted KPI cards, coloured icon chips, confident light **and** dark) as **inspiration, not a copy**.

## Colour tokens (light)

Defined as **OKLCH channel triplets** in `app/globals.css` `:root`. Use `oklch(var(--token))` or Tailwind that maps to those vars.

| Token | Approx intent | Hex-ish |
|---|---|---|
| `--background` / `--surface` | Cool off-white | `#F8FAFC` |
| `--panel` / `--card` / `--ink` | White / raised | `#fff` |
| `--foreground` / `--paper` | Slate-900 blue undertone | near `#0F172A` |
| `--muted-foreground` | Mid slate | |
| `--border` | Slate-200 | |
| `--primary` / `--brand` / `--blue-600` | Action | `#2563EB` |
| `--primary-foreground` | White on blue | `#fff` |
| `--primary-light` / `--blue-50` | Tinted chip bg | |
| `--success` | Teal-green done | chips only |
| `--warning` | Muted gold waiting | chips/icons only |
| `--danger` / `--error` / `--destructive` | Rose | overdue/error |
| `--info` | Sky | |

### Phase washes (journey chips only, ~8–12% chroma)

| Phase | Token | Hue |
|---|---|---|
| SPICe+ Part A / pre-inc-phase-1 | `--phase-pre` | Sky |
| SPICe+ Part B / pre-inc-phase-2 | `--phase-filing` | Teal |
| Post-incorporation | `--phase-post` | Teal-green |
| FEMA (nested under Registration for intern) | `--phase-fema` | Indigo |
| Registration | `--phase-registration` | Violet-blue |

Helper: `src/lib/phase-colors.ts` → Tailwind bundles `PHASE_CLASSES`.

### Categorical accents (tags, avatars, calendars)

`--accent-emerald`, `--accent-sky`, `--accent-amber`, `--accent-violet`, `--accent-rose`, `--accent-orange`, `--accent-teal`, `--accent-pink`, `--accent-cyan`, `--accent-lime` — each with `-soft` pair. These are **not** the primary brand.

### Role accents

`[data-role="admin|manager|intern|client"]` can override `--role-accent`. **Today they are all still blue-family.** A redesign *may* give intern a distinct accent; do not silently make client orange.

Nav icon tones (inactive): home = role, work = primary, queue = warning, people/calendar/files/knowledge/analytics = info/success/teal, audit = tertiary.

## Radius, type, density

- `--radius`: `0.875rem` (fairly soft).
- Type scale tokens: `--text-xs` 11px through `--text-3xl` 32px. Body ~15px (`0.9375rem`).
- Sidebar item min-height 42px; mobile tap 44px.
- Cards: `Surface` / shadcn `Card`. Hairline borders, light shadow via `--shadow-ink`.
- Forms: `.milestone-form-grid` 2 columns from `md`; short fields pair; textarea/file/address full width. Upload zone ~44px tall (max 88px), not a hero dropzone. Textareas `min-h` 72px / 3 rows.

## Typography

| Role | Face | CSS |
|---|---|---|
| UI | Manrope | `--font-sans` |
| Display / H1 | Space Grotesk | `--font-serif` (yes, named serif) |
| Mono | IBM Plex Mono | `--font-mono` |

Marketing hero uses **serif display + mono eyebrow**. Intern company H1 is serif. Most UI is Manrope.

## Motion

`src/lib/motion.ts`: `springSnappy`, `springGentle`, `fadeUp`, `cardHover`, `pressScale`.  
Page: `.page-fade-up`. Journey: `.journey-node-pulse`, `.journey-unlock`, `.journey-complete`. Skeletons: `.skeleton-brand`.  
Sidebar active: `layoutId` pill. **No scale/transform on those hosts.**

## Component kits (duplication to collapse in a restyle)

Known sprawl (from UX audit — still true in spirit):

- **4 KPI implementations**: `AccentKpi`, `KpiCard`, ad-hoc `Surface` KPIs, dead `MetricCard`.
- **10+ status pills**: `StatusPill`, `StatusBadge`, `StatusDot`, `StatusPillWithTimeline`, `ResponsibleRoleBadge`, shadcn `Badge`, per-view maps, Vault `EntityPill`.
- **Empty states**: illustrated (`EmptyStateIllustrated`) on some views; bare strings on others; intern Requests can be a blank table.
- **Progress bars**: mixed primary vs leftover gold-sheen class names (sheen still paints blue).
- **Toasts**: shadcn + `react-hot-toast`. `sonner.tsx` is a fake re-export.

A visual redesign is a good moment to **pick one KPI, one status chip, one empty state, one toast**.

## Shell / marketing specifics

- Login + marketing: polished in both themes; login tinted chips are the colourful reference.
- Marketing hex sometimes bypasses tokens (`LandingCta`, `HeroProductPlane`, `SbcLogo`) — restyle should put them on tokens.
- Full-screen “Opening VCFO Suite…” (`AuthBootScreen`) between navigations feels slow vs skeletons.
- Docx preview forces `bg-white` (acceptable for a paper metaphor; overlay should follow theme).
- Onboarding wizard is a **light-theme island** (`slate-*` / `bg-white`) — either restyle to tokens or retire in favour of Create Project + Pre-1.

## Dark mode

`next-themes`, class strategy. Dark tokens live under `.dark` in `globals.css` (same file). Any new palette **must** specify both. Breakers: raw `bg-white`, `text-slate-900`, default `emerald-*` / `red-*` / `violet-*` / `amber-*` not wired through tokens.

## How to restyle with least risk (recommended sequence)

1. Redefine OKLCH tokens in `app/globals.css` (light + dark + optional `data-role`).
2. Swap fonts in `app/layout.tsx`.
3. Update logo SVGs + `SbcLogo`.
4. Restyle `Surface`, `AccentButton`, `PageHeader`, `JourneyNode`, sidebar/topbar.
5. Marketing sections + login.
6. Hunt remaining raw palette classes (onboarding, audit badges, docx chrome).
7. Only then invent new layout patterns (e.g. intern workspace).

Changing `--primary` alone will recolour most CTAs, rings, and intern active states. Phase washes should stay **analogous and quieter than primary** or phases compete with CTAs.
